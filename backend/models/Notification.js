const mongoose = require('mongoose');

/**
 * Notification model — unified schema
 * Fields match what services/workers use: recipientId, actorId, entityId
 */
const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['like', 'comment', 'follow', 'reply', 'mention', 'save', 'takedown', 'copyright_strike', 'admin_alert'],
      required: true,
    },
    entityId:   { type: mongoose.Schema.Types.ObjectId }, // postId, storyId, chapterId, userId, or reportId
    entityType: { type: String, enum: ['Post', 'Story', 'Chapter', 'Report'], default: 'Post' },
    reasonText: { type: String, maxlength: 300, default: '' }, // shown to the user for takedown/strike notifications
    isRead:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
