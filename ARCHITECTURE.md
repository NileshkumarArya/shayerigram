# ShayeriGram — System Architecture

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS → Vercel
- **Backend:** Node.js + Express → Railway/Render
- **Database:** MongoDB Atlas (M10+ for production)
- **Cache:** Redis (Upstash for serverless, or dedicated)
- **Queue:** BullMQ (requires Redis)
- **Media:** Cloudinary (images)
- **Email:** Nodemailer (Gmail SMTP / SendGrid)
- **Payments:** Razorpay

## Data Flow

```
User Action
    ↓
React Frontend (UNTRUSTED — just UI)
    ↓
API Request (HTTPS)
    ↓
Express Backend
    ├── Rate Limiter
    ├── Auth Middleware
    ├── Abuse Detection
    ├── Validator
    ↓
Service Layer (business logic)
    ├── MongoDB (persistent data)
    ├── Redis (cache + rate limits)
    └── BullMQ (async jobs)
          ├── Email Worker
          └── Notification Worker
```

## Collection Design (Scalable)

NO large arrays in documents:

| Old (Bad) | New (Scalable) |
|-----------|----------------|
| Post.likes[] | Like collection |
| User.followers[] | Follow collection |
| Post.comments[] | Comment collection |
| User.savedPosts[] | Save collection |

Counters denormalized for display speed:
- User: followersCount, followingCount
- Post: likesCount, commentsCount, savesCount

## Pagination

ALL lists use cursor pagination (not skip/limit):
- Feed: cursor by createdAt + _id
- Comments: cursor by createdAt
- Followers/Following: cursor by createdAt
- Admin reports: cursor by createdAt

## Ad System

Backend injects ad slots into feed array:
- Every 5 posts → 1 ad slot
- Client renders {type: 'ad'} differently
- Ad events tracked server-side

## Deployment Targets

| Service | Provider | Notes |
|---------|----------|-------|
| Frontend | Vercel | Free tier OK |
| Backend | Railway | $5/mo starter |
| MongoDB | Atlas | M10 ($57/mo) for prod |
| Redis | Upstash | Free tier OK |
| Media | Cloudinary | Free tier OK |

## Workers (run separately)

```bash
node jobs/workers/emailWorker.js
node jobs/workers/notificationWorker.js
```

## Scaling

- Backend: stateless → add instances behind load balancer
- Socket.IO: Redis adapter for multi-instance
- MongoDB: Atlas auto-scaling + read replicas
- Feed: Redis cache first page (30s TTL)
