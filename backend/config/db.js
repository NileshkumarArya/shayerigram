const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // ✅ Drop old text index that conflicts with 'language' field
    try {
      await conn.connection.collection('posts').dropIndex('content_text_title_text_hashtags_text');
    } catch {} // Ignore if index doesn't exist
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
