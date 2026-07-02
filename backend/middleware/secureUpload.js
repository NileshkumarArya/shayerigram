/**
 * Secure Upload Pipeline
 * Defence layers (in order):
 *   1. Multer — file size + file count limit
 *   2. MIME type whitelist (multer fileFilter)
 *   3. Magic byte check (file-type) — catches fake extensions
 *   4. MIME vs magic byte mismatch alert — catches polyglots
 *   5. Sharp re-encode — destroys ALL hidden payloads, EXIF, metadata
 *   6. Pixel bomb protection — limitInputPixels
 *   7. Output buffer size check
 *   8. Duplicate upload detection — SHA-256 hash per user
 *   9. Suspicious upload logging — Sentry + logger alert
 *  10. Auto watermark (posts only)
 *  11. Cloudinary upload with random UUID public_id
 */
const multer   = require('multer');
const sharp    = require('sharp');
const FileType = require('file-type');
const { v4: uuidv4 } = require('uuid');
const crypto   = require('crypto');
const { cloudinary } = require('../config/cloudinary');
const logger   = require('../utils/logger');
const { getCache, setCache } = require('../utils/cache');

// ─── Allowed MIME types — SVG/HTML/XML all BLOCKED ───────────────────────
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PIXELS   = 20_000_000;                    // 20MP — pixel bomb protection
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;          // 10MB output cap

// ─── Suspicious upload alert ──────────────────────────────────────────────
// FIX A: Log + alert on suspicious uploads so we know about attacks
const alertSuspiciousUpload = (reason, req, extra = {}) => {
  const info = {
    reason,
    userId:   req.user?._id,
    username: req.user?.username,
    ip:       req.ip,
    ua:       req.headers['user-agent']?.slice(0, 100),
    filename: req.file?.originalname?.slice(0, 100),
    size:     req.file?.size,
    ...extra,
  };
  logger.warn(`[SUSPICIOUS UPLOAD] ${reason}`, info);

  // Send to Sentry if available
  try {
    const Sentry = require('@sentry/node');
    Sentry.captureMessage(`Suspicious upload: ${reason}`, {
      level: 'warning',
      extra: info,
    });
  } catch {}
};

// ─── Duplicate detection via SHA-256 hash (per user) ─────────────────────
// FIX B: Prevent same file being uploaded repeatedly (spam/flood)
const getUploadCacheKey = (buffer, userId) => {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return `upload_hash:${userId}:${hash}`;
};

const isDuplicateUpload = async (buffer, userId) => {
  try {
    return !!(await getCache(getUploadCacheKey(buffer, userId)));
  } catch {
    return false;
  }
};

const markUploadHash = async (buffer, userId) => {
  try {
    await setCache(getUploadCacheKey(buffer, userId), '1', 86400);
  } catch {
    // Cache unavailable — upload already succeeded, so do not fail response.
  }
};

// ─── Multer memory storage factory ───────────────────────────────────────
const createMulter = (maxMb = 5) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_MIME.includes(file.mimetype)) {
        // Alert on blocked MIME — attacker tried an invalid type
        logger.warn('[UPLOAD BLOCKED] Invalid MIME type', {
          mimetype: file.mimetype,
          filename: file.originalname?.slice(0, 100),
          ip: req.ip,
          userId: req.user?._id,
        });
        return cb(new Error('Invalid file type. Only JPEG, PNG, WebP are allowed.'));
      }
      cb(null, true);
    },
  });

// ─── Cloudinary stream uploader ───────────────────────────────────────────
const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const safePublicId = uuidv4();
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: safePublicId, resource_type: 'image', format: 'jpg', overwrite: false },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });

// ─── Core processing pipeline ─────────────────────────────────────────────
const processAndUpload = ({ folder, width, height, fit = 'inside', quality = 82 }) =>
  async (req, res, next) => {
    if (!req.file) return next();

    try {
      const buffer = req.file.buffer;

      // ── FIX B: Duplicate detection ─────────────────────────────────────
      if (req.user?._id) {
        const duplicate = await isDuplicateUpload(buffer, String(req.user._id));
        if (duplicate) {
          alertSuspiciousUpload('Duplicate upload detected', req, { folder });
          return res.status(400).json({
            message: 'This image was already uploaded recently. Please use a different image.',
          });
        }
      }

      // ── Magic Bytes Check ──────────────────────────────────────────────
      const detected = await FileType.fromBuffer(buffer);
      if (!detected || !ALLOWED_MIME.includes(detected.mime)) {
        // FIX A: Alert — magic bytes don't match any allowed type
        alertSuspiciousUpload('Magic byte mismatch — possible polyglot/malware', req, {
          detectedMime: detected?.mime || 'unknown',
          claimedMime:  req.file.mimetype,
        });
        return res.status(400).json({
          message: 'Invalid image. File content does not match allowed types (JPEG/PNG/WebP).',
        });
      }

      // ── FIX A: MIME vs Magic byte mismatch alert ───────────────────────
      // e.g. file claims image/png but magic bytes say image/jpeg — suspicious
      if (detected.mime !== req.file.mimetype) {
        alertSuspiciousUpload('MIME type vs magic byte mismatch', req, {
          claimedMime:  req.file.mimetype,
          detectedMime: detected.mime,
          folder,
        });
        // Still allowed if both are in ALLOWED_MIME — just log it
        // (e.g. browser sends wrong mime, image still valid)
      }

      // ── Sharp Re-processing ────────────────────────────────────────────
      // Completely destroys: hidden payloads, polyglots, EXIF, metadata, scripts
      let resized;
      try {
        resized = await sharp(buffer, { limitInputPixels: MAX_PIXELS })
          .rotate()
          .resize({ width, height, fit, withoutEnlargement: true })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
      } catch (sharpErr) {
        // FIX A: Sharp failed — likely malformed/malicious image
        alertSuspiciousUpload('Sharp processing failed — possible malformed/malicious image', req, {
          error: sharpErr.message,
        });
        return res.status(400).json({
          message: 'Image processing failed. Please use a valid JPG/PNG image.',
        });
      }

      // ── Output buffer size check ───────────────────────────────────────
      if (resized.length > MAX_OUTPUT_BYTES) {
        alertSuspiciousUpload('Output buffer exceeded 10MB after re-encoding', req, {
          outputSize: resized.length,
        });
        return res.status(400).json({ message: 'Processed image too large. Please use a smaller image.' });
      }

      // ── Auto Watermark (posts only) ────────────────────────────────────
      let safeBuffer = resized;
      if (folder.includes('posts')) {
        try {
          const meta = await sharp(resized).metadata();
          const w    = meta.width || 800;
          const bar  = await sharp({
            create: { width: w, height: 36, channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0.5 } }
          }).png().toBuffer();

          safeBuffer = await sharp(resized)
            .composite([{ input: bar, gravity: 'south', blend: 'over' }])
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
        } catch {
          safeBuffer = resized; // Watermark failed — non-fatal
        }
      }

      // ── Upload to Cloudinary ───────────────────────────────────────────
      const uploaded = await uploadToCloudinary(safeBuffer, folder);

      if (req.user?._id) {
        await markUploadHash(buffer, String(req.user._id));
      }

      req.safeUpload = { url: uploaded.secure_url, publicId: uploaded.public_id };
      next();

    } catch (err) {
      logger.error('[SECURE UPLOAD ERROR]', { error: err.message, userId: req.user?._id });
      const msg = err.message?.includes('Invalid API') || err.message?.includes('401')
        ? 'Cloudinary credentials invalid. Check CLOUDINARY_API_SECRET in .env'
        : 'Image processing failed. Please use a valid JPG/PNG image under 8MB.';
      return res.status(400).json({ message: msg });
    }
  };

// ─── Post image pipeline ──────────────────────────────────────────────────
const uploadPostImage = [
  createMulter(8).single('image'),
  processAndUpload({ folder: 'shayerigram/posts', width: 1200, height: 1200 }),
];

// ─── Avatar image pipeline ────────────────────────────────────────────────
const uploadAvatarImage = [
  createMulter(5).single('avatar'),
  processAndUpload({ folder: 'shayerigram/avatars', width: 400, height: 400, fit: 'cover', quality: 80 }),
];

// ─── Story cover image pipeline ───────────────────────────────────────────
const uploadStoryCoverImage = [
  createMulter(5).single('cover'),
  processAndUpload({ folder: 'shayerigram/story-covers', width: 400, height: 600, fit: 'cover', quality: 82 }),
];

// ─── Club cover image pipeline ────────────────────────────────────────────
const uploadClubCoverImage = [
  createMulter(5).single('cover'),
  processAndUpload({ folder: 'shayerigram/club-covers', width: 800, height: 400, fit: 'cover', quality: 82 }),
];

// ─── Chapter audio pipeline (separate — audio nahi image hai) ─────────────
const ALLOWED_AUDIO_MIME = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'];
const MAX_AUDIO_BYTES = 30 * 1024 * 1024; // 30MB

const createAudioMulter = () =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_AUDIO_MIME.includes(file.mimetype)) {
        logger.warn('[UPLOAD BLOCKED] Invalid audio MIME type', {
          mimetype: file.mimetype,
          filename: file.originalname?.slice(0, 100),
          ip: req.ip,
          userId: req.user?._id,
        });
        return cb(new Error('Invalid audio type. Only MP3, WAV, M4A allowed.'));
      }
      cb(null, true);
    },
  });

const processAudioUpload = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const buffer = req.file.buffer;

    // Magic byte check — audio files ke liye bhi zaroori hai
    const detected = await FileType.fromBuffer(buffer);
    const allowedAudioMagic = ['audio/mpeg', 'audio/x-wav', 'audio/mp4'];
    if (!detected || !allowedAudioMagic.includes(detected.mime)) {
      alertSuspiciousUpload('Audio magic byte mismatch', req, {
        detectedMime: detected?.mime || 'unknown',
        claimedMime:  req.file.mimetype,
      });
      return res.status(400).json({ message: 'Invalid audio file. Content does not match allowed types.' });
    }

    // Duplicate check
    if (req.user?._id) {
      const duplicate = await isDuplicateUpload(buffer, String(req.user._id));
      if (duplicate) {
        return res.status(400).json({
          message: 'This audio was already uploaded recently.',
        });
      }
    }

    // Cloudinary upload — resource_type 'video' (Cloudinary audio ko isi se handle karta hai)
    const safePublicId = uuidv4();
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder:        'shayerigram/chapter-audio',
          public_id:     safePublicId,
          resource_type: 'video',
          overwrite:     false,
        },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(buffer);
    });

    if (req.user?._id) {
      await markUploadHash(buffer, String(req.user._id));
    }

    req.safeUpload = {
      url:      uploaded.secure_url,
      publicId: uploaded.public_id,
      duration: Math.round(uploaded.duration || 0),
    };
    next();

  } catch (err) {
    logger.error('[AUDIO UPLOAD ERROR]', { error: err.message, userId: req.user?._id });
    return res.status(400).json({ message: 'Audio processing failed. Please try a valid MP3/WAV/M4A file.' });
  }
};

const uploadChapterAudio = [
  createAudioMulter().single('audio'),
  processAudioUpload,
];

// ─── Multer error handler ─────────────────────────────────────────────────
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ message: 'File too large. Max 8MB for posts, 5MB for avatars.' });
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  if (err?.message) return res.status(400).json({ message: err.message });
  next(err);
};

const uploadPostImageFile = uploadPostImage[0];
const processPostImage = uploadPostImage[1];

module.exports = {
  uploadPostImage,
  uploadPostImageFile,
  processPostImage,
  uploadAvatarImage,
  uploadStoryCoverImage,
  uploadClubCoverImage,
  uploadChapterAudio,
  multerErrorHandler,
};
