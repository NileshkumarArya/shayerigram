const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  createOrder, razorpayWebhook, getWallet, getPackages,
} = require('../controllers/paymentController');

// Public
router.get('/packages', getPackages);

// Authenticated
router.get('/wallet',      protect, getWallet);
router.post('/create-order', protect, createOrder);

// ✅ Webhook — raw body needed for signature verification
// This route is called by Razorpay, NOT by the client
// No auth middleware — Razorpay doesn't send JWT
router.post('/webhook/razorpay', razorpayWebhook);

module.exports = router;
