const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,               // default 100 hai — 0.1 vCPU box ke liye bahut zyada
      serverSelectionTimeoutMS: 8000, // Atlas hiccup pe hang hone ki jagah fail-fast
      socketTimeoutMS: 20000,
    });
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
