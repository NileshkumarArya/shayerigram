const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with env credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// We use secureUpload.js middleware for all uploads
// (magic bytes check + Sharp processing + direct stream to Cloudinary)
module.exports = { cloudinary };
