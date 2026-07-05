require('dotenv').config();
const mongoose = require('mongoose');
const User   = require('../models/User');
const Follow = require('../models/Follow');
const Block  = require('../models/Block');

// SAFETY: by default this ONLY reports what it would change.
// Nothing in the database is touched unless you explicitly pass --confirm.
const CONFIRM = process.argv.includes('--confirm');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(CONFIRM
    ? '⚠️  LIVE RUN — changes WILL be written to the database\n'
    : '🔍 DRY RUN — nothing will be changed. Pass --confirm to actually apply fixes.\n');

  // ── Step A: find lingering Follow docs between already-blocked pairs ─────
  // (root cause of the drift — blocking used to leave the old Follow intact)
  const blocks = await Block.find({}).select('blockerId blockeeId').lean();
  let staleFollowsFound = 0;

  for (const b of blocks) {
    const stale = await Follow.find({
      $or: [
        { followerId: b.blockerId, followingId: b.blockeeId },
        { followerId: b.blockeeId, followingId: b.blockerId },
      ],
    }).lean();

    if (stale.length > 0) {
      staleFollowsFound += stale.length;
      console.log(`Stale follow between blocked pair ${b.blockerId} <-> ${b.blockeeId}: ${stale.length} doc(s)`);
      if (CONFIRM) {
        await Follow.deleteMany({
          $or: [
            { followerId: b.blockerId, followingId: b.blockeeId },
            { followerId: b.blockeeId, followingId: b.blockerId },
          ],
        });
      }
    }
  }
  console.log(`\nStep A: ${CONFIRM ? 'removed' : 'found'} ${staleFollowsFound} stale follow doc(s) between blocked pairs.\n`);

  // ── Step B: recompute followersCount/followingCount for every user ──────
  const users = await User.find({ isDeleted: { $ne: true } })
    .select('_id username followersCount followingCount');
  let mismatches = 0;

  for (const user of users) {
    const [actualFollowers, actualFollowing] = await Promise.all([
      Follow.countDocuments({ followingId: user._id }),
      Follow.countDocuments({ followerId: user._id }),
    ]);

    const followersWrong = actualFollowers !== (user.followersCount || 0);
    const followingWrong = actualFollowing !== (user.followingCount || 0);

    if (followersWrong || followingWrong) {
      mismatches++;
      console.log(`@${user.username}: followers ${user.followersCount || 0} -> ${actualFollowers}, following ${user.followingCount || 0} -> ${actualFollowing}`);
      if (CONFIRM) {
        await User.findByIdAndUpdate(user._id, {
          followersCount: actualFollowers,
          followingCount: actualFollowing,
        });
      }
    }
  }

  console.log(`\nStep B: ${CONFIRM ? 'fixed' : 'would fix'} ${mismatches} of ${users.length} user(s).`);
  console.log(CONFIRM ? '\n✅ Done — database updated.' : '\n👉 Re-run with --confirm to apply these fixes.');

  await mongoose.disconnect();
  process.exit(0);
})();