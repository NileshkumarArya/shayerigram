const Club           = require('../models/Club');
const ClubMembership = require('../models/ClubMembership');
const Post            = require('../models/Post');
const logger          = require('../utils/logger');

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50);

// ─── Create Club ──────────────────────────────────────────────────────────────
exports.createClub = async (req, res) => {
  try {
    const { name, description, theme, emoji } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Club name is required.' });
    }

    let slug = slugify(name);
    const existing = await Club.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const club = await Club.create({
      name: name.trim(),
      slug,
      description: description || '',
      theme: theme || 'General',
      emoji: emoji || '📖',
      createdBy: req.user._id,
      coverImage: req.safeUpload?.url || '',
      coverImagePublicId: req.safeUpload?.publicId || '',
      membersCount: 1,
    });

    await ClubMembership.create({ userId: req.user._id, clubId: club._id, role: 'admin' });

    res.status(201).json({ success: true, club });
  } catch (err) {
    logger.error('createClub error', { error: err.message });
    res.status(500).json({ message: 'Failed to create club.' }); 
  }
};

// ─── List Clubs ───────────────────────────────────────────────────────────────
exports.getClubs = async (req, res) => {
  try {
    const { page = 1, limit = 20, theme } = req.query;
    const filter = { isDeleted: false };
    if (theme && theme !== 'All') filter.theme = theme;

    const clubs = await Club.find(filter)
      .sort({ membersCount: -1, createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    let myClubIds = new Set();
    if (req.user) {
      const memberships = await ClubMembership.find({ userId: req.user._id }).select('clubId').lean();
      myClubIds = new Set(memberships.map(m => String(m.clubId)));
    }

    const withMembership = clubs.map(c => ({ ...c, isMember: myClubIds.has(String(c._id)) }));
    res.json({ success: true, clubs: withMembership });
  } catch (err) {
    logger.error('getClubs error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Single Club ──────────────────────────────────────────────────────────────
exports.getClub = async (req, res) => {
  try {
    const club = await Club.findOne({ _id: req.params.clubId, isDeleted: false })
      .populate('createdBy', '_id username avatar')
      .lean();
    if (!club) return res.status(404).json({ message: 'Club not found.' });

    let isMember = false;
    if (req.user) {
      isMember = !!(await ClubMembership.exists({ userId: req.user._id, clubId: club._id }));
    }

    res.json({ success: true, club, isMember });
  } catch (err) {
    logger.error('getClub error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Join / Leave ─────────────────────────────────────────────────────────────
exports.toggleMembership = async (req, res) => {
  try {
    const { clubId } = req.params;
    const club = await Club.findOne({ _id: clubId, isDeleted: false });
    if (!club) return res.status(404).json({ message: 'Club not found.' });

    // Creator apna khud ka club leave nahi kar sakta
    if (String(club.createdBy) === String(req.user._id)) {
      return res.status(400).json({ message: 'Club creator cannot leave their own club.' });
    }

    const removed = await ClubMembership.deleteOne({ userId: req.user._id, clubId });

    if (removed.deletedCount > 0) {
      const updated = await Club.findOneAndUpdate(
        { _id: clubId, membersCount: { $gt: 0 } },
        { $inc: { membersCount: -1 } },
        { new: true }
      ).select('membersCount');
      return res.json({ success: true, isMember: false, membersCount: Math.max(updated?.membersCount || 0, 0) });
    }

    try {
      await ClubMembership.create({ userId: req.user._id, clubId, role: 'member' });
    } catch (err) {
      if (err.code === 11000) {
        const current = await Club.findById(clubId).select('membersCount');
        return res.json({ success: true, isMember: true, membersCount: current?.membersCount || 0 });
      }
      throw err;
    }

    const updated = await Club.findByIdAndUpdate(clubId, { $inc: { membersCount: 1 } }, { new: true }).select('membersCount');
    res.json({ success: true, isMember: true, membersCount: updated?.membersCount || 0 });
  } catch (err) {
    logger.error('toggleMembership error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── My Clubs ─────────────────────────────────────────────────────────────────
exports.getMyClubs = async (req, res) => {
  try {
    const memberships = await ClubMembership.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    const clubIds = memberships.map(m => m.clubId);
    const clubs = await Club.find({ _id: { $in: clubIds }, isDeleted: false }).lean();
    res.json({ success: true, clubs });
  } catch (err) {
    logger.error('getMyClubs error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ─── Club Posts (cursor paginated) ─────────────────────────────────────────────
exports.getClubPosts = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { cursor } = req.query;
    const limit = parseInt(req.query.limit) || 15;

    const filter = { clubId, isDeleted: { $ne: true }, isTakenDown: { $ne: true } };
    if (cursor) {
      try {
        const { createdAt, _id } = JSON.parse(Buffer.from(cursor, 'base64').toString());
        filter.$or = [
          { createdAt: { $lt: new Date(createdAt) } },
          { createdAt: new Date(createdAt), _id: { $lt: _id } },
        ];
      } catch {}
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('author', '_id username avatar fullName isVerified')
      .lean();

    const hasMore = posts.length > limit;
    const items   = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ createdAt: items.at(-1).createdAt, _id: items.at(-1)._id })).toString('base64')
      : null;

    res.json({ success: true, posts: items, hasMore, nextCursor });
  } catch (err) {
    logger.error('getClubPosts error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};