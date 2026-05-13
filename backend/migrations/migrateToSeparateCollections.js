/**
 * Migration: Array-based → Separate Collections
 * 
 * Migrates:
 *  User.followers[]  → Follow collection
 *  User.following[]  → Follow collection  (deduped)
 *  Post.likes[]      → Like collection
 *  Post.savedBy[]    → Save collection
 *  Post.comments[]   → Comment collection
 * 
 * HOW TO RUN:
 *   NODE_ENV=development node migrations/migrateToSeparateCollections.js
 * 
 * SAFETY:
 *   - Idempotent: safe to run multiple times (uses upsert)
 *   - Batch-processed: no memory blowup
 *   - Logs progress
 *   - Does NOT delete old fields (backward compat)
 */

require('dotenv').config();
const mongoose = require('mongoose');

if (process.env.NODE_ENV === 'production') {
  console.error('❌ BLOCKED: Run in development/staging first!');
  process.exit(1);
}

// ─── Load models ──────────────────────────────────────────────────────────────
const User     = require('../models/User');
const Post     = require('../models/Post');
const Follow   = require('../models/Follow');
const Like     = require('../models/Like');
const Save     = require('../models/Save');
const Comment  = require('../models/Comment');

const BATCH = 100;

async function migrateFollows() {
  console.log('\n📦 Migrating follows...');
  let skip = 0, total = 0, errors = 0;

  while (true) {
    const users = await User.find({ followers: { $exists: true, $not: { $size: 0 } } })
      .select('_id followers').limit(BATCH).skip(skip).lean();
    if (!users.length) break;

    for (const user of users) {
      for (const followerId of (user.followers || [])) {
        try {
          await Follow.updateOne(
            { followerId, followingId: user._id },
            { $setOnInsert: { followerId, followingId: user._id, createdAt: new Date() } },
            { upsert: true }
          );
          total++;
        } catch { errors++; }
      }
    }
    console.log(`  Processed ${skip + users.length} users, ${total} follows migrated`);
    skip += BATCH;
  }
  console.log(`✅ Follows done: ${total} records, ${errors} errors`);
}

async function migrateLikes() {
  console.log('\n📦 Migrating likes...');
  let skip = 0, total = 0, errors = 0;

  while (true) {
    const posts = await Post.find({ likes: { $exists: true, $not: { $size: 0 } } })
      .select('_id likes').limit(BATCH).skip(skip).lean();
    if (!posts.length) break;

    for (const post of posts) {
      for (const userId of (post.likes || [])) {
        try {
          await Like.updateOne(
            { userId, postId: post._id },
            { $setOnInsert: { userId, postId: post._id, createdAt: new Date() } },
            { upsert: true }
          );
          total++;
        } catch { errors++; }
      }
      // Sync likesCount counter
      await Post.findByIdAndUpdate(post._id, { $set: { likesCount: post.likes.length } });
    }
    console.log(`  ${skip + posts.length} posts processed, ${total} likes migrated`);
    skip += BATCH;
  }
  console.log(`✅ Likes done: ${total} records, ${errors} errors`);
}

async function migrateSaves() {
  console.log('\n📦 Migrating saves...');
  let skip = 0, total = 0, errors = 0;

  while (true) {
    const users = await User.find({ savedPosts: { $exists: true, $not: { $size: 0 } } })
      .select('_id savedPosts').limit(BATCH).skip(skip).lean();
    if (!users.length) break;

    for (const user of users) {
      for (const postId of (user.savedPosts || [])) {
        try {
          await Save.updateOne(
            { userId: user._id, postId },
            { $setOnInsert: { userId: user._id, postId, createdAt: new Date() } },
            { upsert: true }
          );
          total++;
        } catch { errors++; }
      }
      // Sync savedCount counter
      await User.findByIdAndUpdate(user._id, { $set: { savedCount: user.savedPosts.length } });
    }
    console.log(`  ${skip + users.length} users processed, ${total} saves migrated`);
    skip += BATCH;
  }
  console.log(`✅ Saves done: ${total} records, ${errors} errors`);
}

async function migrateComments() {
  console.log('\n📦 Migrating comments...');
  let skip = 0, total = 0, errors = 0;

  while (true) {
    const posts = await Post.find({ 'comments.0': { $exists: true } })
      .select('_id comments author').limit(BATCH).skip(skip).lean();
    if (!posts.length) break;

    for (const post of posts) {
      for (const c of (post.comments || [])) {
        try {
          await Comment.updateOne(
            { _id: c._id },
            {
              $setOnInsert: {
                _id:       c._id,
                postId:    post._id,
                authorId:  c.user || c.authorId,
                text:      c.text,
                createdAt: c.createdAt || new Date(),
              }
            },
            { upsert: true }
          );
          total++;
        } catch { errors++; }
      }
      // Sync commentsCount counter
      await Post.findByIdAndUpdate(post._id, { $set: { commentsCount: post.comments.length } });
    }
    console.log(`  ${skip + posts.length} posts processed, ${total} comments migrated`);
    skip += BATCH;
  }
  console.log(`✅ Comments done: ${total} records, ${errors} errors`);
}

async function syncFollowCounts() {
  console.log('\n🔄 Syncing follow counts...');
  let skip = 0;
  while (true) {
    const users = await User.find().select('_id').limit(BATCH).skip(skip).lean();
    if (!users.length) break;
    for (const user of users) {
      const [fc, fgc] = await Promise.all([
        Follow.countDocuments({ followingId: user._id }),
        Follow.countDocuments({ followerId: user._id }),
      ]);
      await User.findByIdAndUpdate(user._id, { $set: { followersCount: fc, followingCount: fgc } });
    }
    skip += BATCH;
    console.log(`  Synced ${skip} users`);
  }
  console.log('✅ Follow counts synced');
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔌 Connected to MongoDB');
    console.log('🚀 Starting migration...\n');

    await migrateFollows();
    await migrateLikes();
    await migrateSaves();
    await migrateComments();
    await syncFollowCounts();

    // ── Verification ────────────────────────────────────────────────────
    console.log('\n📊 Verification:');
    console.log('  Follows:  ', await Follow.countDocuments());
    console.log('  Likes:    ', await Like.countDocuments());
    console.log('  Saves:    ', await Save.countDocuments());
    console.log('  Comments: ', await Comment.countDocuments());

    console.log('\n✅ Migration complete!');
    console.log('ℹ️  Old arrays still exist — safe to read');
    console.log('ℹ️  Remove old fields only after verifying everything works');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
