/**
 * Environment Validator — fails app startup if required vars missing
 * 
 * SECURITY: Prevents production running with dev secrets/fallbacks.
 * Attacker Risk: If JWT_SECRET is empty/default, any JWT token is forgeable.
 */

const REQUIRED_IN_PRODUCTION = [
  'JWT_SECRET',
  'MONGO_URI',
  'CLIENT_URL',
];

const WARNED_IF_MISSING = [
  'REDIS_URL',
  'SMTP_USER',
  'SMTP_PASS',
  'CLOUDINARY_CLOUD_NAME',
  'RAZORPAY_WEBHOOK_SECRET',
  'SENTRY_DSN',
];

const DANGEROUS_DEFAULTS = {
  JWT_SECRET: ['dev_secret_change_in_prod', 'dev_secret', 'secret', 'changeme', ''],
};

const validateEnv = () => {
  const errors  = [];
  const warnings = [];
  const isProd  = process.env.NODE_ENV === 'production';

  // ── Required vars ──────────────────────────────────────────────────────────
  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!process.env[key]) {
      if (isProd) {
        errors.push(`MISSING REQUIRED: ${key}`);
      } else {
        warnings.push(`Missing (OK for dev): ${key}`);
      }
    }
  }

  // ── Dangerous defaults check ───────────────────────────────────────────────
  for (const [key, badValues] of Object.entries(DANGEROUS_DEFAULTS)) {
    const val = process.env[key] || '';
    if (badValues.includes(val)) {
      if (isProd) {
        errors.push(`DANGEROUS DEFAULT: ${key} is set to a known insecure value`);
      } else {
        warnings.push(`Weak ${key} — OK for dev, MUST change for prod`);
      }
    }
  }

  // ── JWT minimum length check ───────────────────────────────────────────────
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret && jwtSecret.length < 32) {
    if (isProd) {
      errors.push(`JWT_SECRET too short (${jwtSecret.length} chars). Minimum 32 chars required.`);
    } else {
      warnings.push(`JWT_SECRET is short (${jwtSecret.length} chars). Use 64+ chars in production.`);
    }
  }

  // ── Optional but recommended ───────────────────────────────────────────────
  for (const key of WARNED_IF_MISSING) {
    if (!process.env[key]) {
      warnings.push(`Optional missing: ${key}`);
    }
  }

  // ── Turnstile secret name check ────────────────────────────────────────────
  // verifyTurnstile.js accepts either name, but warn if BOTH are missing so a
  // typo'd Render var name doesn't silently disable captcha with no signal.
  if (!process.env.TURNSTILE_SECRET_KEY && !process.env.TURNSTILE_SECRET) {
    warnings.push('Neither TURNSTILE_SECRET_KEY nor TURNSTILE_SECRET is set — captcha verification is disabled');
  }

  // ── Print warnings ─────────────────────────────────────────────────────────
  if (warnings.length) {
    console.warn('\n[ENV] Warnings:');
    warnings.forEach(w => console.warn(`  ⚠️  ${w}`));
  }

  // ── Fail on errors ─────────────────────────────────────────────────────────
  if (errors.length) {
    console.error('\n[ENV] ❌ FATAL: Required environment variables missing or insecure:');
    errors.forEach(e => console.error(`  ✗ ${e}`));
    console.error('\n  Fix your .env file and restart.\n');
    process.exit(1); // Hard stop — do not start with missing secrets
  }

  if (isProd) {
    console.log('[ENV] ✅ All required environment variables validated');
  }
};

module.exports = { validateEnv };
