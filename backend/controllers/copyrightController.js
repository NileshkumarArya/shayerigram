const CopyrightStrike = require('../models/CopyrightStrike');
const logger = require('../utils/logger');

// @GET /api/copyright-strikes/my — content owner's own strike history
exports.getMyStrikes = async (req, res) => {
  try {
    const strikes = await CopyrightStrike.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('report', 'reason details')
      .lean();
    res.json({ strikes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load strikes.' });
  }
};

// @PATCH /api/copyright-strikes/:id/dispute — "this isn't actually copied
// content". Sets the strike to 'pending' (excluded from the active count
// while an admin reviews it); resolved later via the admin panel.
exports.disputeStrike = async (req, res) => {
  try {
    const strike = await CopyrightStrike.findById(req.params.id);
    if (!strike) return res.status(404).json({ message: 'Strike not found.' });
    if (String(strike.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not your strike to dispute.' });
    }
    if (strike.disputeStatus !== 'none') {
      return res.status(400).json({ message: `This strike is already ${strike.disputeStatus}.` });
    }

    const { reason } = req.body;
    strike.disputeStatus = 'pending';
    strike.disputeReason = typeof reason === 'string' ? reason.slice(0, 500) : '';
    await strike.save();

    logger.info('Copyright strike disputed', { strikeId: strike._id, userId: req.user._id });
    res.json({ message: 'Dispute submitted. An admin will review it.', strike });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit dispute.' });
  }
};