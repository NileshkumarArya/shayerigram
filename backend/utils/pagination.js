/**
 * ✅ Cursor-based pagination utility
 * 
 * Why cursor > skip/limit:
 * - skip(3980) = MongoDB scans 3980 docs then returns 20
 * - cursor = MongoDB jumps directly to right position via index
 * - At 100k posts: skip is 50x slower than cursor
 * 
 * Usage:
 *   const { filter, sort, decodeCursor, encodeCursor } = buildCursorPagination(req.query);
 *   const posts = await Post.find({ ...baseFilter, ...filter }).sort(sort).limit(limit + 1);
 *   const hasMore = posts.length > limit;
 *   const items = hasMore ? posts.slice(0, limit) : posts;
 *   const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;
 */

const encodeCursor = (doc) => {
  const payload = {
    _id:       doc._id.toString(),
    createdAt: doc.createdAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

const decodeCursor = (cursor) => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

const buildCursorPagination = (query) => {
  const limit = Math.min(20, Math.max(1, parseInt(query.limit) || 10));
  let filter = {};
  let sort = { createdAt: -1, _id: -1 };

  if (query.cursor) {
    const decoded = decodeCursor(query.cursor);
    if (decoded) {
      // Get posts OLDER than the cursor (next page)
      filter = {
        $or: [
          { createdAt: { $lt: new Date(decoded.createdAt) } },
          { createdAt: new Date(decoded.createdAt), _id: { $lt: decoded._id } },
        ],
      };
    }
  }

  return { filter, sort, limit };
};

module.exports = { encodeCursor, decodeCursor, buildCursorPagination };
