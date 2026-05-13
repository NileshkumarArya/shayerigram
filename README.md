# ✦ ShayeriGram — Full-Stack Poetry Social Platform

> *जहाँ शब्द बोलते हैं, जहाँ दिल की बात होती है*

A production-grade Instagram-like social platform built for Shayari (Urdu/Hindi poetry lovers). Dark purple theme, glassmorphism UI, real-time notifications, and a full REST API backend.

---

## 🗂️ Project Structure

```
shayerigram/
├── backend/                  # Node.js + Express API
│   ├── config/
│   │   ├── db.js             # MongoDB connection
│   │   └── cloudinary.js     # Cloudinary image upload config
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── postController.js
│   │   ├── userController.js
│   │   ├── notificationController.js
│   │   └── exploreController.js
│   ├── middleware/
│   │   └── auth.js           # JWT auth middleware
│   ├── models/
│   │   ├── User.js
│   │   ├── Post.js
│   │   └── Notification.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── posts.js
│   │   ├── users.js
│   │   ├── notifications.js
│   │   └── explore.js
│   ├── utils/
│   │   └── seeder.js         # Sample dummy data
│   ├── server.js             # Entry point with Socket.io
│   ├── .env.example
│   └── package.json
│
└── frontend/                 # React + Vite + Tailwind
    ├── src/
    │   ├── components/
    │   │   ├── common/
    │   │   │   ├── Avatar.jsx
    │   │   │   └── LoadingSpinner.jsx
    │   │   ├── feed/
    │   │   │   ├── PostCard.jsx       # Main post card with like/comment/share
    │   │   │   └── CreatePostModal.jsx
    │   │   └── layout/
    │   │       ├── Layout.jsx
    │   │       ├── Sidebar.jsx
    │   │       ├── RightPanel.jsx
    │   │       └── MobileBottomNav.jsx
    │   ├── pages/
    │   │   ├── HomePage.jsx           # Feed with infinite scroll
    │   │   ├── LoginPage.jsx
    │   │   ├── RegisterPage.jsx
    │   │   ├── ProfilePage.jsx        # Instagram-style grid
    │   │   ├── ExplorePage.jsx        # Search + categories + trending
    │   │   ├── PostPage.jsx           # Single post detail
    │   │   ├── NotificationsPage.jsx
    │   │   ├── SavedPage.jsx
    │   │   ├── EditProfilePage.jsx
    │   │   ├── CreatePostPage.jsx
    │   │   └── HashtagPage.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx        # Global auth state
    │   ├── services/
    │   │   └── api.js                 # All API calls (axios)
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css                  # Global styles, animations, variables
    ├── tailwind.config.js
    ├── vite.config.js
    └── package.json
```

---

## ⚡ Quick Setup (Step-by-Step)

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Cloudinary account (free tier works)

---

### 1️⃣ Clone & Install

```bash
# Clone the repo
git clone <your-repo-url>
cd shayerigram

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

### 2️⃣ Configure Backend Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/shayerigram
JWT_SECRET=your_super_secret_jwt_key_change_this_to_something_long
JWT_EXPIRE=30d

# Get these from cloudinary.com (free account)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

CLIENT_URL=http://localhost:5173
```

> **Cloudinary Setup:** Go to [cloudinary.com](https://cloudinary.com), create a free account, and copy credentials from the Dashboard.

---

### 3️⃣ Seed Sample Data (Optional but Recommended)

```bash
cd backend
npm run seed
```

This creates:
- 5 sample Shayar accounts (verified users)
- 10 beautiful Shayari posts (Ghalib, Faiz, Gulzar etc.)
- Follow relationships between users

**Demo Login After Seeding:**
```
Email: ghalib@shayari.com
Password: password123
```

---

### 4️⃣ Configure Frontend

```bash
cd frontend
```

Edit `vite.config.js` — proxy is already set to `http://localhost:5000`.

---

### 5️⃣ Run the Application

```bash
# Terminal 1 — Backend
cd backend
npm run dev
# Server starts at http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm run dev
# App starts at http://localhost:5173
```

Open **http://localhost:5173** 🎉

---

## 🎯 Feature Checklist

| Feature | Status |
|---|---|
| User Registration & Login (JWT) | ✅ |
| User Profile (avatar, bio, stats) | ✅ |
| Edit Profile + Avatar Upload | ✅ |
| Create Text Shayari | ✅ |
| Create Image Shayari (overlay) | ✅ |
| Like / Unlike Posts | ✅ |
| Comment on Posts | ✅ |
| Save / Bookmark Posts | ✅ |
| Share Posts | ✅ |
| Follow / Unfollow Users | ✅ |
| Followers / Following List | ✅ |
| Home Feed (followed users) | ✅ |
| Infinite Scroll Feed | ✅ |
| Double-tap to Like | ✅ |
| Explore Page | ✅ |
| Search Users & Shayari | ✅ |
| Category Filters | ✅ |
| Trending Posts | ✅ |
| Hashtag System | ✅ |
| Notifications (like/comment/follow) | ✅ |
| Saved Posts Page | ✅ |
| Dark Theme + Glassmorphism | ✅ |
| Mobile Responsive | ✅ |
| Real-time (Socket.io ready) | ✅ |
| Post Categories (Love/Sad/etc) | ✅ |
| Multiple Languages (Hindi/Urdu/English) | ✅ |
| Instagram-style Profile Grid | ✅ |

---

## 🎨 Design System

```css
Colors:
  Primary Background: #080810
  Purple Primary:     #9333ea
  Purple Light:       #c084fc
  Gold Accent:        #f59e0b
  Text Primary:       #f1f0ff
  Text Muted:         #5a5480

Fonts:
  Display: Playfair Display (Shayari text)
  Urdu:    Noto Nastaliq Urdu
  Logo:    Cinzel
  Body:    DM Sans
```

---

## 🔌 API Endpoints

### Auth
```
POST /api/auth/register    — Register new user
POST /api/auth/login       — Login
GET  /api/auth/me          — Get current user
```

### Posts
```
GET  /api/posts/feed       — Get feed (auth required)
GET  /api/posts/trending   — Get trending posts
POST /api/posts            — Create post (with image upload)
GET  /api/posts/:id        — Get single post
DELETE /api/posts/:id      — Delete post
POST /api/posts/:id/like   — Like/Unlike toggle
POST /api/posts/:id/comment — Add comment
DELETE /api/posts/:id/comment/:cId — Delete comment
POST /api/posts/:id/save   — Save/Unsave toggle
```

### Users
```
GET  /api/users/suggestions     — Get follow suggestions
GET  /api/users/saved           — Get saved posts
PUT  /api/users/profile         — Update profile
POST /api/users/:id/follow      — Follow/Unfollow toggle
GET  /api/users/:username       — Get user profile
GET  /api/users/:username/posts — Get user posts
```

### Explore
```
GET /api/explore/search          — Search posts & users
GET /api/explore/trending        — Trending posts
GET /api/explore/category/:cat  — Posts by category
GET /api/explore/hashtag/:tag   — Posts by hashtag
```

### Notifications
```
GET /api/notifications            — Get all notifications
GET /api/notifications/unread-count — Get unread count
PUT /api/notifications/mark-read  — Mark all as read
```

---

## 📱 Screenshots Overview

- **Login/Register** — Split-panel with live Shayari preview
- **Feed** — Infinite scroll with glassmorphism post cards
- **Profile** — Instagram-style grid with stats
- **Explore** — Search + category grid + trending
- **Create Post** — 3-step wizard with theme templates
- **Notifications** — Filterable notification feed

---

## 🚀 Production Deployment

### Backend (Railway/Render/Heroku)
1. Push backend to GitHub
2. Connect to Railway/Render
3. Set environment variables
4. Deploy

### Frontend (Vercel/Netlify)
1. Update `vite.config.js` — change proxy to production API URL
2. Build: `npm run build`
3. Deploy `dist/` folder to Vercel

### MongoDB Atlas (Production DB)
1. Create free cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Get connection string
3. Update `MONGO_URI` in production environment

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Auth | JWT (JSON Web Tokens) |
| Images | Cloudinary |
| Real-time | Socket.io |
| HTTP Client | Axios |
| Notifications | react-hot-toast |

---

*Built with ✦ for the lovers of Shayari*
