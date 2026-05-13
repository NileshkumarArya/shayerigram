const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ['post', 'user', 'comment'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      enum: ['spam', 'harassment', 'hate_speech', 'inappropriate', 'copyright', 'other'],
    },
    details:    { type: String, maxlength: 500, default: '' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['open', 'reviewed', 'resolved', 'rejected'],
      default: 'open',
      index: true,
    },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:  { type: Date },
    actionTaken: { type: String, default: '' },
  },
  { timestamps: true }
);

reportSchema.index({ createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });

// Critical for admin moderation queue
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedContent: 1, contentType: 1 });

module.exports = mongoose.model('Report', reportSchema);
