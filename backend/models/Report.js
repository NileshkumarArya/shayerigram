const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ['post', 'user', 'comment', 'story', 'chapter'],
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
      enum: [
        'spam',
        'harassment',
        'hate_speech',
        'nudity_sexual_content',
        'violence',
        'impersonation',
        'copyright',
        'inappropriate',
        'other',
      ],
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
reportSchema.index(
  { targetType: 1, targetId: 1, reportedBy: 1 },
  { unique: true }
);

module.exports = mongoose.model('Report', reportSchema);