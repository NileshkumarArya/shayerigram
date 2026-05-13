/**
 * Cache Key Constants
 * Centralized cache key builder — prevents key mismatch bugs across services
 * All cache invalidations must use these helpers
 */
const cacheKeys = {
  userProfileById:      (userId)   => `user:profile:id:${userId}`,
  usernameLookup:       (username) => `user:username:${String(username).toLowerCase()}`,
  postById:             (postId)   => `post:id:${postId}`,
  feedFirstPage:        (userId)   => `feed:first:${userId}`,
  unreadNotifications:  (userId)   => `notif:unread:${userId}`,
  trendingPosts:        ()         => `trending:posts`,
  hashtagPosts:         (tag)      => `hashtag:${tag.toLowerCase()}`,
};

module.exports = cacheKeys;
