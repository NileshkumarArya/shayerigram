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
      enum: ['like', 'comment', 'follow', 'reply', 'mention', 'save'],
      required: true,
    },
    entityId:   { type: mongoose.Schema.Types.ObjectId }, // postId, storyId, or userId
    entityType: { type: String, enum: ['Post', 'Story'], default: 'Post' }, // NEW — tells us which collection to look up
    isRead:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
