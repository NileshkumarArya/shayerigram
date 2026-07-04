require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const indexes = await mongoose.connection.db.collection('stories').indexes();
  console.log('Current indexes on "stories":', indexes.map(i => i.name));

  const textIndex = indexes.find(i => i.textIndexVersion);
  if (textIndex) {
    await mongoose.connection.db.collection('stories').dropIndex(textIndex.name);
    console.log(`✅ Dropped broken text index: ${textIndex.name}`);
  } else {
    console.log('✅ No text index found — already clean, nothing to do.');
  }

  await mongoose.disconnect();
  process.exit(0);
})();