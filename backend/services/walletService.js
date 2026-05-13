/**
 * Wallet Service — ONLY way to modify coin balances
 *
 * Design:
 *   - All operations use MongoDB sessions (ACID transactions)
 *   - Debit checks balance INSIDE the transaction (prevents race conditions)
 *   - Every operation creates an immutable Transaction ledger entry
 *   - idempotencyKey prevents double-processing (webhook replays etc.)
 */
const mongoose   = require('mongoose');
const Wallet     = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const logger     = require('../utils/logger');

/**
 * Get or create wallet for a user
 */
const getOrCreateWallet = async (userId, session = null) => {
  const opts = session ? { session } : {};
  let wallet = await Wallet.findOne({ userId }, null, opts);
  if (!wallet) {
    [wallet] = await Wallet.create([{ userId }], opts);
  }
  return wallet;
};

/**
 * CREDIT — add coins to wallet
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {number} opts.amount
 * @param {string} opts.reason
 * @param {string} opts.idempotencyKey - prevents duplicate credits (webhook replay)
 * @param {string} opts.referenceId - payment ID, gift ID etc.
 * @param {string} opts.referenceType
 * @param {Object} opts.metadata
 */
const credit = async ({ userId, amount, reason, idempotencyKey, referenceId, referenceType, metadata = {} }) => {
  if (!amount || amount <= 0) throw new Error('Invalid credit amount');

  // Idempotency check BEFORE starting session
  if (idempotencyKey) {
    const existing = await Transaction.findOne({ idempotencyKey });
    if (existing) {
      logger.warn('Duplicate transaction blocked', { idempotencyKey, userId });
      return { duplicate: true, transaction: existing };
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await getOrCreateWallet(userId, session);

    // Atomic increment
    const updated = await Wallet.findByIdAndUpdate(
      wallet._id,
      {
        // ✅ Single $inc — both balance + version in one atomic op
        $inc: { balance: amount, lifetimeEarned: amount, version: 1 },
      },
      { new: true, session }
    );

    const tx = await Transaction.create([{
      userId,
      type:         'credit',
      amount,
      reason,
      balanceAfter: updated.balance,
      idempotencyKey,
      referenceId,
      referenceType,
      metadata,
    }], { session });

    await session.commitTransaction();
    logger.info('Wallet credited', { userId, amount, reason, newBalance: updated.balance });
    return { wallet: updated, transaction: tx[0] };
  } catch (err) {
    await session.abortTransaction();
    logger.error('Credit failed', { userId, amount, error: err.message });
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * DEBIT — spend coins from wallet
 * Checks balance INSIDE transaction to prevent race conditions
 */
const debit = async ({ userId, amount, reason, idempotencyKey, referenceId, referenceType, metadata = {} }) => {
  if (!amount || amount <= 0) throw new Error('Invalid debit amount');

  if (idempotencyKey) {
    const existing = await Transaction.findOne({ idempotencyKey });
    if (existing) return { duplicate: true, transaction: existing };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await getOrCreateWallet(userId, session);

    // ✅ Balance check INSIDE transaction — prevents race condition
    if (wallet.balance < amount) {
      await session.abortTransaction();
      throw Object.assign(new Error('Insufficient balance'), { status: 400, code: 'INSUFFICIENT_BALANCE' });
    }

    const updated = await Wallet.findByIdAndUpdate(
      wallet._id,
      {
        // ✅ FIX: single $inc — prevents duplicate key bug
        $inc: { balance: -amount, lifetimeSpent: amount, version: 1 },
      },
      { new: true, session }
    );

    const tx = await Transaction.create([{
      userId,
      type:         'debit',
      amount,
      reason,
      balanceAfter: updated.balance,
      idempotencyKey,
      referenceId,
      referenceType,
      metadata,
    }], { session });

    await session.commitTransaction();
    logger.info('Wallet debited', { userId, amount, reason, newBalance: updated.balance });
    return { wallet: updated, transaction: tx[0] };
  } catch (err) {
    await session.abortTransaction();
    if (err.code !== 'INSUFFICIENT_BALANCE') {
      logger.error('Debit failed', { userId, amount, error: err.message });
    }
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * Get balance — read from DB (not cache for accuracy)
 */
const getBalance = async (userId) => {
  const wallet = await Wallet.findOne({ userId }).lean();
  return wallet?.balance ?? 0;
};

/**
 * Get transaction history (cursor-paginated)
 */
const getHistory = async (userId, query = {}) => {
  const { buildCursorPagination, encodeCursor } = require('../utils/pagination');
  const { filter, sort, limit } = buildCursorPagination(query);

  const txs = await Transaction.find({ userId, ...filter })
    .sort(sort).limit(limit + 1).lean();

  const hasMore = txs.length > limit;
  const items   = hasMore ? txs.slice(0, limit) : txs;

  return {
    transactions: items,
    hasMore,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
  };
};

/**
 * Verify balance integrity — sum of transactions should equal balance
 * Run this periodically for audit
 */
const verifyIntegrity = async (userId) => {
  const [wallet, agg] = await Promise.all([
    Wallet.findOne({ userId }).lean(),
    Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: {
        _id: null,
        totalCredit: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
        totalDebit:  { $sum: { $cond: [{ $eq: ['$type', 'debit'] },  '$amount', 0] } },
      }},
    ]),
  ]);

  const agg0 = agg[0] || { totalCredit: 0, totalDebit: 0 };
  const expected = agg0.totalCredit - agg0.totalDebit;
  const actual   = wallet?.balance ?? 0;
  const matches  = Math.abs(expected - actual) < 0.001;

  if (!matches) {
    logger.error('WALLET INTEGRITY MISMATCH', { userId, expected, actual });
  }

  return { userId, expected, actual, matches };
};

module.exports = { credit, debit, getBalance, getHistory, getOrCreateWallet, verifyIntegrity };
