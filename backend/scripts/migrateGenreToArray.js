require('dotenv').config();
const mongoose = require('mongoose');
const Story = require('../models/Story');

const DRY_RUN = !process.argv.includes('--confirm');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const raw = await mongoose.connection.db.collection('stories')
    .find({ genre: { $type: 'string' } }).toArray();

  console.log(`Found ${raw.length} stories with a string genre (need array conversion).`);
  console.log(DRY_RUN ? 'DRY RUN — no changes will be written. Pass --confirm to apply.' : 'CONFIRMED — writing changes.');

  for (const doc of raw) {
    console.log(`  ${doc._id}: "${doc.genre}" -> ["${doc.genre}"]`);
    if (!DRY_RUN) {
      await mongoose.connection.db.collection('stories')
        .updateOne({ _id: doc._id }, { $set: { genre: [doc.genre] } });
    }
  }

  console.log('Done.');
  process.exit(0);
})();