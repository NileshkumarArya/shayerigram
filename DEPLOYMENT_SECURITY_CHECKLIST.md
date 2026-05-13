# ShayeriGram Deployment Security Checklist

## Already handled in code
- Strict CORS allowlist driven by `CLIENT_URL`
- HttpOnly auth cookie
- Helmet + CSP + no-sniff + frame deny
- Upload hardening with MIME + magic-bytes + Sharp re-encode
- Rate limiting for auth, uploads, posts, comments, likes, follow actions
- Mongo sanitize and request validation
- Socket authentication

## Still required outside code before production
1. Rotate all secrets: `JWT_SECRET`, Mongo credentials, Cloudinary secret.
2. Keep `CLIENT_URL` exact. Example: `https://shayerigram.com,https://www.shayerigram.com`.
3. Enable MongoDB Atlas backups / snapshots.
4. Lock down Cloudinary upload settings and allowed domains.
5. Put the app behind HTTPS and preferably Cloudflare or another WAF/CDN.
6. Harden the server/VPS: SSH keys only, disable password login, enable fail2ban.
7. Add monitoring: Sentry, uptime alerts, log retention.
8. Review `npm audit` results before every deploy.

## Suggestions review
- **Strict CORS**: needed, and this codebase already supports it through `CLIENT_URL`.
- **Automated DB backups**: needed. Infrastructure task, not code.
- **Cloudinary restricted mode**: recommended. Do it in dashboard.
- **Environment secret rotation**: mandatory if any secret was ever shared.
- **Cloudflare / WAF**: recommended, especially for public launch.
- **SSH hardening**: needed only if you deploy on your own VPS.
- **Sentry**: recommended, not mandatory for first launch.
- **UptimeRobot**: recommended.
- **Login alert system**: nice next-step feature, not blocking for MVP.
