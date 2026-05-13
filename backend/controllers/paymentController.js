/**
 * Payment Controller — Production-hardened
 *
 * Security model:
 *   1. Client creates order → gets orderId only (never coins amount)
 *   2. Razorpay webhook hits → we verify HMAC signature using rawBody
 *   3. ONLY verified webhook can credit coins
 *   4. Idempotency key prevents double-credit on webhook retry
 *
 * Attack vectors blocked:
 *   - Fake webhook (signature mismatch → rejected)
 *   - Replay attack (idempotencyKey unique per payment)
 *   - Client-side coin crediting (impossible — only webhook credits)
 *   - Wrong amount (coinsToCredit taken from DB order, not client)
 */
const crypto        = require('crypto');
const Payment       = require('../models/Payment');
const walletService = require('../services/walletService');
const logger        = require('../utils/logger');

const COIN_PACKAGES = {
  pack_100:  { coins: 100,  price: 4900,   currency: 'INR' },
  pack_500:  { coins: 500,  price: 19900,  currency: 'INR' },
  pack_1000: { coins: 1000, price: 34900,  currency: 'INR' },
  pack_5000: { coins: 5000, price: 149900, currency: 'INR' },
};

// ─── Feature flag — disable if not fully tested ───────────────────────────────
const COINS_ENABLED = String(process.env.ENABLE_COINS) === 'true';

// ─── Get Packages ─────────────────────────────────────────────────────────────
exports.getPackages = (req, res) => {
  if (!COINS_ENABLED) return res.status(503).json({ message: 'Coins system not available yet.' });
  res.json({
    packages: Object.entries(COIN_PACKAGES).map(([id, pkg]) => ({
      id,
      coins:        pkg.coins,
      price:        pkg.price,
      currency:     pkg.currency,
      priceDisplay: `₹${(pkg.price / 100).toFixed(0)}`,
    })),
  });
};

// ─── Create Order ─────────────────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  if (!COINS_ENABLED) return res.status(503).json({ message: 'Coins system not available yet.' });

  try {
    const { packageId } = req.body;
    const pkg = COIN_PACKAGES[packageId];
    if (!pkg) return res.status(400).json({ message: 'Invalid package.' });

    // Generate orderId (replace with real Razorpay SDK in production)
    const orderId = `order_${Date.now()}_${require('crypto').randomBytes(6).toString('hex')}`;

    // Save order to DB BEFORE returning to client
    await Payment.create({
      userId:        req.user._id,
      provider:      'razorpay',
      orderId,
      amount:        pkg.price,
      currency:      pkg.currency,
      coinsToCredit: pkg.coins,
      status:        'pending',
    });

    logger.info('Payment order created', { userId: req.user._id, orderId, coins: pkg.coins });

    // Return only public key + orderId (never coin amount — taken from DB on webhook)
    res.json({
      orderId,
      amount:   pkg.price,
      currency: pkg.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    logger.error('Create order failed', { error: err.message });
    res.status(500).json({ message: 'Failed to create order.' });
  }
};

// ─── Razorpay Webhook ─────────────────────────────────────────────────────────
exports.razorpayWebhook = async (req, res) => {
  // ✅ CRITICAL: Fail hard if webhook secret not configured
  // Without this check, a missing env var silently accepts ALL webhooks
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('SECURITY: RAZORPAY_WEBHOOK_SECRET not set — rejecting all webhooks');
    return res.status(500).json({ message: 'Webhook not configured.' });
  }

  try {
    // ✅ Signature verification using rawBody (JSON.stringify is WRONG — order may differ)
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      logger.warn('Webhook missing signature header', { ip: req.ip });
      return res.status(400).json({ message: 'Missing signature.' });
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      logger.error('rawBody not available — check server.js rawBody middleware');
      return res.status(500).json({ message: 'Internal error.' });
    }

    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // ✅ Constant-time comparison prevents timing attacks
    const sigBuf  = Buffer.from(signature, 'hex');
    const expBuf  = Buffer.from(expected,  'hex');
    const isValid = sigBuf.length === expBuf.length &&
                    crypto.timingSafeEqual(sigBuf, expBuf);

    if (!isValid) {
      logger.warn('Webhook signature mismatch — possible fake request', { ip: req.ip });
      return res.status(400).json({ message: 'Invalid signature.' });
    }

    const event = req.body;
    if (event.event !== 'payment.captured') {
      return res.json({ status: 'ignored' });
    }

    const entity    = event.payload?.payment?.entity;
    const orderId   = entity?.order_id;
    const paymentId = entity?.id;
    const paidAmount = entity?.amount; // in paise

    if (!orderId || !paymentId) {
      return res.status(400).json({ message: 'Invalid payload.' });
    }

    // ✅ Find pending order in DB (not from webhook payload — never trust client amounts)
    const payment = await Payment.findOne({ orderId, status: 'pending' });
    if (!payment) {
      logger.warn('Webhook for unknown/processed order', { orderId });
      return res.json({ status: 'ok' }); // 200 so Razorpay doesn't retry
    }

    // ✅ Amount verification — what Razorpay says must match what we stored
    if (paidAmount && paidAmount !== payment.amount) {
      logger.error('SECURITY: Payment amount mismatch', {
        orderId, expected: payment.amount, received: paidAmount,
      });
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'failed', failureReason: 'Amount mismatch',
      });
      return res.status(400).json({ message: 'Amount mismatch.' });
    }

    // ✅ Mark payment paid
    await Payment.findByIdAndUpdate(payment._id, {
      paymentId,
      status:          'paid',
      webhookVerified: true,
      processedAt:     new Date(),
    });

    // ✅ Credit coins — idempotencyKey = payment_ + paymentId prevents double-credit
    await walletService.credit({
      userId:         payment.userId,
      amount:         payment.coinsToCredit,
      reason:         'purchase',
      idempotencyKey: `payment_${paymentId}`,
      referenceId:    paymentId,
      referenceType:  'payment',
      metadata:       { orderId, packageCoins: payment.coinsToCredit },
    });

    logger.info('Payment verified + coins credited', {
      userId:  payment.userId,
      paymentId,
      coins:   payment.coinsToCredit,
      orderId,
    });

    res.json({ status: 'ok' });
  } catch (err) {
    logger.error('Webhook processing failed', { error: err.message });
    res.status(500).json({ message: 'Processing failed.' });
  }
};

// ─── Get Wallet ───────────────────────────────────────────────────────────────
exports.getWallet = async (req, res) => {
  try {
    const balance = await walletService.getBalance(req.user._id);
    const history = await walletService.getHistory(req.user._id, req.query);
    res.json({ balance, ...history });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load wallet.' });
  }
};
