const mongoose = require('mongoose');
// ✅ PRODUCTION SAFETY GUARD — prevent accidental run in production
if (process.env.NODE_ENV === 'production') {
  console.error('[SEEDER] ❌ BLOCKED: Cannot run seeder in production!');
  console.error('[SEEDER] This would DELETE all production data.');
  console.error('[SEEDER] Set NODE_ENV=development to run seeder.');
  process.exit(1);
}

console.warn('[SEEDER] ⚠️  WARNING: This will DELETE all existing data!');
console.warn('[SEEDER] Running in:', process.env.NODE_ENV || 'development');
console.warn('[SEEDER] Starting in 3 seconds... (Ctrl+C to cancel)');


const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const Post = require('../models/Post');

const users = [
  { username: 'mirza_ghalib', email: 'ghalib@shayari.com', password: 'password123',
    fullName: 'Mirza Ghalib', bio: 'Dard ka haq ada karta hoon... 🌙', isVerified: true },
  { username: 'faiz_ahmed', email: 'faiz@shayari.com', password: 'password123',
    fullName: 'Faiz Ahmed', bio: 'Ishq mujhe aur shayari ka koi maazi nahi', isVerified: true },
  { username: 'gulzar_sahab', email: 'gulzar@shayari.com', password: 'password123',
    fullName: 'Gulzar Sahab', bio: 'Alfaazon ka jadoogar 🎭', isVerified: true },
  { username: 'parveen_shakir', email: 'parveen@shayari.com', password: 'password123',
    fullName: 'Parveen Shakir', bio: 'Mohabbat ke alfaaz mere dil se nikle hain' },
  { username: 'javed_akhtar', email: 'javed@shayari.com', password: 'password123',
    fullName: 'Javed Akhtar', bio: 'Har lafz mera apna hai' },
];

const shayaris = [
  { content: 'Hazaaron khwaishein aisi ke har khwaish pe dam nikle,\nBahut nikle mere armaan lekin phir bhi kam nikle. 🌹\n\n#ghalib #urdu #classic', category: 'Love', language: 'Urdu' },
  { content: 'Dil dhoondta hai phir wahi fursat ke raat din,\nBaithe rahen tasavvur-e-jaana kiye hue.\n\n#ghalib #mohabbat #shayari', category: 'Love', language: 'Urdu' },
  { content: 'Hum dekhenge, lazim hai ke hum bhi dekhenge,\nVo din ke jiska vaada hai, jo lohe-e-azal mein likha hai.\n\n#faiz #resistance #hope', category: 'Motivational', language: 'Urdu' },
  { content: 'Aaj bazar mein pa-ba-jaulan chalo,\nChashm-e-nam, jan-e-shauridah kaafi nahi.\n\n#faiz #revolution #shayari', category: 'Motivational', language: 'Urdu' },
  { content: 'Tum itna jo muskura rahe ho,\nKya gham hai jisko chhupa rahe ho?\n\n#gulzar #dard #emotions', category: 'Sad', language: 'Hindi' },
  { content: 'Raat bhar roshan raha mere khayalon mein tera chehra,\nSubah teri yaad ne phir se ujala kar diya. ☀️\n\n#love #yaad #shayari', category: 'Love', language: 'Hindi' },
  { content: 'Rishton ki daraar ko\nMain bharta raha khaamoshi se,\nPar khaamoshi bhi ek roz\nBol hi padi. 💔\n\n#sad #dard #zindagi', category: 'Sad', language: 'Hindi' },
  { content: 'Zindagi ko itna serious mat lo,\nYahan se zinda koi nahi jaata.\nMuskurao, jiyo, aur dono haath phailao.\n\n#motivation #life #zindagi', category: 'Motivational', language: 'Hindi' },
  { content: 'Dosti woh nahi jo bahut zyada hua ho,\nDosti woh hai jo mushkil mein kaam aaya ho. 🤝\n\n#friendship #dost #yaari', category: 'Friendship', language: 'Hindi' },
  { content: 'Chaand se puchha maine ek raat,\nKya tune bhi kabhi mohabbat ki hai?\nChaand muskuraya aur bola –\nKyun warna main roz teri khirki pe aata? 🌙\n\n#love #chaand #romantic', category: 'Love', language: 'Hindi' },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await User.deleteMany();
    await Post.deleteMany();

    const createdUsers = await User.create(users);
    console.log(`${createdUsers.length} users created`);

    const posts = shayaris.map((s, i) => ({
      ...s,
      author: createdUsers[i % createdUsers.length]._id,
      likes: [createdUsers[(i + 1) % createdUsers.length]._id, createdUsers[(i + 2) % createdUsers.length]._id],
    }));

    await Post.create(posts);
    console.log(`${posts.length} posts created`);

    // Make some users follow each other
    for (let i = 0; i < createdUsers.length; i++) {
      const next = createdUsers[(i + 1) % createdUsers.length];
      await User.findByIdAndUpdate(createdUsers[i]._id, { $push: { following: next._id } });
      await User.findByIdAndUpdate(next._id, { $push: { followers: createdUsers[i]._id } });
    }

    console.log('Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
