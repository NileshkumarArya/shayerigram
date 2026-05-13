/**
 * Environment Validator — runs at startup
 * App CRASHES if required env vars are missing in production
 * Prevents: forged JWTs, fake webhook payments, missing auth secrets
 */

const REQUIRED_ALWAYS = [
  'MONGO_URI',
  'JWT_SECRET',
];

const REQUIRED_IN_PRODUCTION = [
  'RAZORPAY_WEBHOOK_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'CLIENT_URL',
];

const MIN_LENGTHS = {
  JWT_SECRET: 32,
};

const validateEnv = () => {
  const missing = [];
  const weak    = [];
  const isProd  = process.env.NODE_ENV === 'production';

  // Always required
  for (const key of REQUIRED_ALWAYS) {
    if (!process.env[key]) missing.push(key);
  }

  // Required in production
  if (isProd) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!process.env[key]) missing.push(key);
    }
  }

  // Minimum length checks
  for (const [key, minLen] of Object.entries(MIN_LENGTHS)) {
    const val = process.env[key];
    if (val && val.length < minLen) {
      weak.push(`${key} must be at least ${minLen} characters (current: ${val.length})`);
    }
  }

  if (missing.length > 0) {
    console.error('\n❌ MISSING REQUIRED ENVIRONMENT VARIABLES:');
    missing.forEach(k => console.error(`   • ${k}`));
    console.error('\nCopy .env.example to .env and fill in the values.\n');
    process.exit(1);
  }

  if (weak.length > 0) {
    const action = isProd ? 'exit' : 'warn';
    console.warn('\n⚠️  WEAK ENVIRONMENT VARIABLES:');
    weak.forEach(w => console.warn(`   • ${w}`));
    if (isProd) {
      console.error('\nAborting in production with weak secrets.\n');
      process.exit(1);
    }
  }

  if (isProd) {
    console.info('✅ Environment validation passed (production mode)');
  }
};

module.exports = { validateEnv };
