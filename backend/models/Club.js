const mongoose = require('mongoose');

/**
 * Club — community group around a theme (Horror Club, Shayari Club, etc.)
 * Posts optionally belong to a club via Post.clubId — no separate content type.
 */
const clubSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 60 },
    slug:        { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: '', maxlength: 300 },
    coverImage:  { type: String, default: '' },
    coverImagePublicId: { type: String },
    emoji:       { type: String, default: '📖' },
    theme: {
      type: String,
      enum: ['Love','Sad','Horror','Motivation','Comedy','Thriller','Fantasy','Poetry','Spiritual','General'],
      default: 'General',
    },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    membersCount: { type: Number, default: 1, min: 0 },
    postsCount:   { type: Number, default: 0, min: 0 },
    isDeleted:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

clubSchema.index({ membersCount: -1 });
clubSchema.index({ createdAt: -1 });
clubSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Club', clubSchema);