# ShayeriGram — Security Architecture

## Threat Model

Attackers WILL:
- Reverse engineer the frontend/APK
- Use mod APKs to bypass client checks
- Run bot scripts to spam likes/follows
- Replay API requests
- Try to fake payment success
- Enumerate user data

**Solution: Backend is the only source of truth. Client is NEVER trusted.**

---

## Security Layers

```
Request
  ↓ HTTPS (TLS 1.2+)
  ↓ NGINX (reverse proxy, DDoS mitigation)
  ↓ Helmet (security headers)
  ↓ CORS (allowlist-only origins)
  ↓ Request ID (trace every request)
  ↓ Bot detection (User-Agent check)
  ↓ Rate Limiter (per-IP + per-user, Redis-backed)
  ↓ Auth (JWT 15min access + 30d refresh)
  ↓ Abuse Detection (velocity check, risk scoring)
  ↓ Input Validation (express-validator)
  ↓ MongoDB Sanitize (NoSQL injection prevention)
  ↓ Business Logic (server-side only)
  ↓ Response
```

---

## Auth Flow

```
Login → Access Token (15min JWT) + Refresh Token (30d, stored in DB)
      ↓
Request → Access Token in httpOnly cookie
      ↓
Token expired → Auto-refresh via /api/auth/refresh
      ↓
Refresh invalid → Force re-login
      ↓
Logout → Revoke refresh token in DB
Logout all devices → Revoke ALL refresh tokens for user
```

---

## Payment Flow (Razorpay)

```
Client → POST /api/payment/create-order → Backend creates DB record
       ← orderId ←
Client → Razorpay payment UI
       → Razorpay webhook → POST /api/payment/webhook/razorpay
                           → Verify HMAC signature
                           → Find order in DB
                           → Credit coins (idempotent)
```

**Client CANNOT credit coins. Only verified webhook can.**

---

## Abuse Detection

| Action  | Window | Max | Block Type |
|---------|--------|-----|------------|
| like    | 60s    | 60  | Warn + log |
| follow  | 60s    | 20  | Hard block |
| comment | 60s    | 20  | Warn + log |
| post    | 1hr    | 15  | Warn + log |

---

## Environment Variables Required

```
JWT_SECRET=          (64+ chars random)
RAZORPAY_KEY_ID=     (from dashboard)
RAZORPAY_KEY_SECRET= (from dashboard)
RAZORPAY_WEBHOOK_SECRET= (from dashboard)
REDIS_URL=           (for rate limiting + cache)
MONGO_URI=           (MongoDB Atlas)
SMTP_USER=           (for emails)
SMTP_PASS=           (Gmail app password)
CROSS_DOMAIN=        (true for Vercel+Railway)
```
