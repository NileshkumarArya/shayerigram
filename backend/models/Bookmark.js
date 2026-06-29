const mongoose = require('mongoose');

const BookmarkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
    },
    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      default: null,
    },
    note: {
      type: String,
      maxlength: 200,
      default: '',
    },
  },
  { timestamps: true }
);

// Ek user ek story ko ek baar bookmark kar sakta hai
BookmarkSchema.index({ user: 1, story: 1 }, { unique: true });
BookmarkSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Bookmark', BookmarkSchema);