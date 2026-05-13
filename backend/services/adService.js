/**
 * Ad Service — backend-aware ad slot injection
 *
 * Design principle:
 *   - Backend controls WHERE ads appear (not client)
 *   - Client cannot skip ads by manipulating response
 *   - Ad frequency controlled server-side
 *   - Future: real ad network integration (Google AdMob, Meta Audience Network)
 *
 * Phase 1 (current): placeholder ads, position metadata
 * Phase 2: Real ad network SDK calls
 * Phase 3: Personalized ads based on user category preferences
 */

// Ad frequency: every N posts, inject an ad slot
const AD_EVERY_N_POSTS = 5; // 1 ad per 5 posts

// Ad types
const AD_TYPES = {
  BANNER: 'banner',
  NATIVE: 'native',  // Looks like a post but labeled "Sponsored"
};

/**
 * Inject ad slots into a feed array
 * Backend returns {type: 'ad', ...} objects mixed into post array
 * Client renders them differently based on type
 *
 * @param {Array} posts - regular post objects
 * @param {Object} user - for future personalization
 * @returns {Array} posts with ad slots injected
 */
const injectAdSlots = (posts, user = null) => {
  if (!posts || posts.length === 0) return posts;

  const result = [];
  let adCounter = 0;

  posts.forEach((post, index) => {
    result.push(post);

    // Inject ad after every N posts (but not after last post)
    if ((index + 1) % AD_EVERY_N_POSTS === 0 && index < posts.length - 1) {
      adCounter++;
      result.push(createAdSlot(adCounter, user));
    }
  });

  return result;
};

/**
 * Create an ad slot placeholder
 * In production: replace with real ad network call
 */
const createAdSlot = (position, user = null) => ({
  _id:       `ad_slot_${position}_${Date.now()}`,
  type:      'ad',                     // Client checks this to render ad component
  adType:    AD_TYPES.NATIVE,
  position,
  // Future fields for real ad integration:
  // adUnitId: 'ca-app-pub-xxxxx/yyyyyy',
  // targeting: { categories: user?.preferredCategories },
  sponsored: true,
  label:     'Sponsored',
});

/**
 * Track ad event — backend validates, client cannot fake
 * (Actual ad network events go through their own SDK, but we track impressions)
 */
const trackAdEvent = async (req, res) => {
  try {
    const { adId, event } = req.body; // event: 'impression' | 'click'

    const validEvents = ['impression', 'click'];
    if (!validEvents.includes(event)) {
      return res.status(400).json({ message: 'Invalid ad event' });
    }

    // Log for analytics (async — don't block response)
    // In production: forward to ad network impression tracking URL
    console.log('[AD EVENT]', {
      userId: req.user?._id,
      adId,
      event,
      ip:    req.ip,
      ts:    new Date().toISOString(),
    });

    res.json({ tracked: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to track ad event' });
  }
};

module.exports = { injectAdSlots, trackAdEvent, AD_EVERY_N_POSTS };
