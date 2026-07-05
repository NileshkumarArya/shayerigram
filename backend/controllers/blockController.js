const Block = require('../models/Block');
const User  = require('../models/User');

// @POST /api/users/:id/block
exports.blockUser = async (req, res) => {
  try {
    const blockerId = req.user._id;
    const blockeeId = req.params.id;

    if (String(blockerId) === String(blockeeId))
      return res.status(400).json({ message: "You can't block yourself." });

    const target = await User.findById(blockeeId).select('username');
    if (!target) return res.status(404).json({ message: 'User not found.' });

    await Block.findOneAndUpdate(
      { blockerId, blockeeId },
      { blockerId, blockeeId },
      { upsert: true, new: true }
    );

    // Blocking should sever any existing follow relationship in EITHER
    // direction — otherwise the Follow doc lingers, keeping followersCount/
    // followingCount inflated even though the blocked user is hidden from
    // the followers/following lists (causing a count-vs-list mismatch).
    const Follow = require('../models/Follow');
    const [removedAsFollower, removedAsFollowing] = await Promise.all([
      Follow.findOneAndDelete({ followerId: blockerId, followingId: blockeeId }),
      Follow.findOneAndDelete({ followerId: blockeeId, followingId: blockerId }),
    ]);

    const decrements = [];
    if (removedAsFollower) {
      decrements.push(User.findByIdAndUpdate(blockerId, { $inc: { followingCount: -1 } }));
      decrements.push(User.findByIdAndUpdate(blockeeId, { $inc: { followersCount: -1 } }));
    }
    if (removedAsFollowing) {
      decrements.push(User.findByIdAndUpdate(blockeeId, { $inc: { followingCount: -1 } }));
      decrements.push(User.findByIdAndUpdate(blockerId, { $inc: { followersCount: -1 } }));
    }
    if (decrements.length) await Promise.all(decrements);

    const { invalidateCache } = require('../utils/cache');
    await invalidateCache([
      `user:profile:id:${blockerId}`,
      `user:profile:id:${blockeeId}`,
    ]);

    res.json({ message: `${target.username} blocked successfully.`, isBlocked: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to block user.' });
  }
};

// @DELETE /api/users/:id/block
exports.unblockUser = async (req, res) => {
  try {
    const blockerId = req.user._id;
    const blockeeId = req.params.id;

    await Block.findOneAndDelete({ blockerId, blockeeId });
    res.json({ message: 'User unblocked.', isBlocked: false });
  } catch (err) {
    res.status(500).json({ message: 'Failed to unblock user.' });
  }
};

// @GET /api/users/blocked — list of blocked users
exports.getBlockedUsers = async (req, res) => {
  try {
    const blocks = await Block.find({ blockerId: req.user._id })
      .populate('blockeeId', 'username fullName avatar')
      .sort({ createdAt: -1 })
      .lean();

    const users = blocks.map(b => ({ ...b.blockeeId, blockedAt: b.createdAt }));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get blocked users.' });
  }
};

// @GET /api/users/:id/block-status
exports.getBlockStatus = async (req, res) => {
  try {
    const block = await Block.findOne({
      blockerId: req.user._id,
      blockeeId: req.params.id,
    });
    res.json({ isBlocked: !!block });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get block status.' });
  }
};
