const User = require('../models/User');
const { enqueueNotification } = require('../jobs/queues/notificationQueue');

// Alerts every admin account the moment a report comes in — uses the same
// Notification/Socket.IO pipeline as everything else, so it shows up
// in-app immediately instead of relying on someone remembering to open
// the Admin Panel and check.
const notifyAdminsOfReport = async (reporterId, report) => {
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  await Promise.all(admins.map((admin) =>
    enqueueNotification({
      recipientId: admin._id,
      actorId:     reporterId,
      type:        'admin_alert',
      entityId:    report._id,
      entityType:  'Report',
    })
  ));
};

module.exports = { notifyAdminsOfReport };