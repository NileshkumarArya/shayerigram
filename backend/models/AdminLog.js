const mongoose = require('mongoose');

/**
 * AdminLog — Every admin action recorded in DB
 * logger.warn() rotates — this persists forever for audit
 */
const adminLogSchema = new mongoose.Schema(
  {
    adminId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action:     { type: String, required: true }, // e.g. 'SUSPEND_USER', 'DELETE_POST'
    targetId:   { type: mongoose.Schema.Types.ObjectId },
    targetType: { type: String, enum: ['User', 'Post', 'Comment', 'Report'] },
    reason:     { type: String, maxlength: 500 },
    ip:         { type: String, maxlength: 45 },
    meta:       { type: mongoose.Schema.Types.Mixed }, // extra context
  },
  { timestamps: true }
);

adminLogSchema.index({ adminId: 1, createdAt: -1 });
adminLogSchema.index({ targetId: 1 });
adminLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
