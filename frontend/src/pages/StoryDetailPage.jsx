import { useState, useEffect, useRef } from 'react';
import { optimizeImageUrl } from '../utils/image';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storyAPI, chapterAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Avatar from '../components/common/Avatar';

function TimeAgo({ date }) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StoryDetailPage() {
  const { storyId } = useParams();
  const { user } = useAuth();

  const [story, setStory] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [progress, setProgress] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [similarStories, setSimilarStories] = useState([]);
  const commentInputRef = useRef(null);

  // ✅ FIX: scrolls to + focuses the comment input when the comment icon is clicked
  const scrollToComments = () => {
    commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => commentInputRef.current?.focus(), 400);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [storyRes, chaptersRes, commentsRes, similarRes] = await Promise.all([
          storyAPI.getStory(storyId),
          chapterAPI.getChapters(storyId),
          storyAPI.getComments(storyId),
          storyAPI.getSimilarStories(storyId),
        ]);
        setStory(storyRes.data.story);
        setProgress(storyRes.data.progress);
        setIsBookmarked(storyRes.data.isBookmarked);
        setLiked(storyRes.data.isLiked ?? false);
        setLikeCount(storyRes.data.story?.totalLikes ?? 0);
        setChapters(chaptersRes.data.chapters);
        setComments(commentsRes.data.comments || []);
        setSimilarStories(similarRes.data.stories || []);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [storyId]);

  const handleBookmark = async () => {
    setBookmarkLoading(true);
    try {
      const { data } = await storyAPI.toggleBookmark(storyId);
      setIsBookmarked(data.isBookmarked);
    } catch (err) {
      console.error('Bookmark error:', err);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    const wasLiked = liked;
    const previousCount = likeCount;
    setLiked(!wasLiked);
    setLikeCount(prev => Math.max((prev || 0) + (wasLiked ? -1 : 1), 0));
    try {
      const { data } = await storyAPI.toggleLike(storyId);
      setLiked(!!data.liked);
      if (typeof data.totalLikes === 'number') {
        setLikeCount(Math.max(data.totalLikes, 0));
      }
    } catch (err) {
      setLiked(wasLiked);
      setLikeCount(previousCount);
      console.error('Like error:', err);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    const text = comment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await storyAPI.addComment(storyId, text);
      if (data.comment) {
        setComments(prev => {
          if (prev.some(c => c._id === data.comment._id)) return prev;
          return [...prev, data.comment];
        });
      }
      setComment('');
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentLike = async (commentId) => {
    setComments(prev => prev.map(c => c._id === commentId
      ? { ...c, liked: !c.liked, likesCount: Math.max((c.likesCount || 0) + (c.liked ? -1 : 1), 0) }
      : c));
    try {
      const { data } = await storyAPI.toggleCommentLike(storyId, commentId);
      setComments(prev => prev.map(c => c._id === commentId
        ? { ...c, liked: !!data.liked, likesCount: data.likesCount }
        : c));
    } catch {
      setComments(prev => prev.map(c => c._id === commentId
        ? { ...c, liked: !c.liked, likesCount: Math.max((c.likesCount || 0) + (c.liked ? 1 : -1), 0) }
        : c));
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await storyAPI.deleteComment(storyId, commentId);
      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch (err) {
      console.error('Delete comment error:', err);
    }
  };

  // Only the link is shared — not the story title/description
  const handleShare = () => {
    const url = window.location.origin + `/story/${storyId}`;
    if (navigator.share) {
      navigator.share({ url });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!story) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">📖</div>
        <h3 className="text-lg font-semibold mb-2">Story not found</h3>
      </div>
    );
  }

  const isAuthor = user?._id === story.author?._id;
  const publishedChapters = chapters.filter(c => c.status === 'published');
  const startChapter = progress?.lastChapter || publishedChapters[0];

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Story header */}
      <div className="flex gap-5 mb-6">
        <div className="w-32 aspect-[2/3] rounded-xl overflow-hidden shrink-0"
          style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
          {story.coverImage ? (
            <img src={optimizeImageUrl(story.coverImage, { width: 500 })} alt={story.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-2">
              <p className="text-xs font-shayari text-center line-clamp-5" style={{ color: 'var(--text-secondary)' }}>
                {story.title}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{story.title}</h1>
          <Link to={`/profile/${story.author?.username}`} className="text-sm hover:underline" style={{ color: 'var(--purple-light)' }}>
            by {story.author?.username}
          </Link>

          <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>📖 {story.totalChapters} chapters</span>
            <span>👁️ {story.totalReads} reads</span>
            <span>🔖 {story.totalBookmarks}</span>
          </div>

          <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: 'rgba(147,51,234,0.15)', color: 'var(--purple-light)' }}>
            {story.genre}
          </span>

          {story.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {story.tags.map(t => (
                <span key={t} className="text-xs" style={{ color: 'var(--text-muted)' }}>#{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {story.description && (
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
          {story.description}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mb-6">
        {publishedChapters.length > 0 ? (
          <Link to={`/read/${startChapter._id || startChapter.lastChapter}`} className="btn-primary flex-1 text-center py-3 text-sm">
            {progress ? `▶ Continue Ch. ${progress.lastChapterNumber}` : '▶ Start Reading'}
          </Link>
        ) : (
          <div className="flex-1 text-center py-3 text-sm rounded-xl" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            No chapters published yet
          </div>
        )}

        {!isAuthor && (
          <button onClick={handleBookmark} disabled={bookmarkLoading}
            className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
            style={isBookmarked
              ? { background: 'rgba(147,51,234,0.2)', color: 'var(--purple-light)', border: '1px solid rgba(147,51,234,0.4)' }
              : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {isBookmarked ? '🔖 Saved' : '🔖 Save'}
          </button>
        )}

        {isAuthor && (
          <Link to={`/story/${storyId}/edit`} className="btn-ghost px-5 py-3 text-sm">
            ✏️ Edit
          </Link>
        )}
      </div>

      {/* Like / Comment / Share bar */}
      <div className="flex items-center gap-5 mb-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={handleLike} disabled={likeLoading}
          className="flex items-center gap-2 transition-all hover:scale-110 disabled:opacity-60">
          <span className="text-2xl">{liked ? '❤️' : '🤍'}</span>
          <span className="text-sm font-semibold" style={{ color: liked ? '#f87171' : 'var(--text-muted)' }}>
            {likeCount}
          </span>
        </button>
        <button onClick={scrollToComments}
          className="flex items-center gap-2 transition-all hover:scale-110">
          <span className="text-2xl">💬</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            {comments.length}
          </span>
        </button>
        <button onClick={handleShare} className="text-2xl transition-all hover:scale-110">🔗</button>
      </div>

      {/* Chapters list */}
      <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        Chapters ({publishedChapters.length})
      </h2>

      <div className="space-y-2.5">
        {publishedChapters.map(ch => {
          const isRead = progress?.lastChapterNumber > ch.chapterNumber ||
            (progress?.lastChapterNumber === ch.chapterNumber && progress?.isCompleted);
          const isCurrent = progress?.lastChapterNumber === ch.chapterNumber && !progress?.isCompleted;
          return (
            <Link key={ch._id} to={`/read/${ch._id}`}
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
              style={{
                background: isCurrent ? 'rgba(147,51,234,0.08)' : 'rgba(255,255,255,0.03)',
                border: isCurrent ? '1px solid rgba(147,51,234,0.3)' : '1px solid var(--border)',
              }}>
              {ch.coverImage ? (
                <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0">
                  <img src={optimizeImageUrl(ch.coverImage, { width: 120 })} alt={ch.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-10 h-14 rounded-lg shrink-0 flex items-center justify-center font-bold text-sm"
                  style={{
                    background: isCurrent ? 'linear-gradient(135deg,#9333ea,#7c3aed)' : 'rgba(255,255,255,0.06)',
                    color: isCurrent ? 'white' : 'var(--text-muted)',
                  }}>
                  {ch.chapterNumber}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {ch.title}
                </p>
                <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <span>{ch.readingTime} min read</span>
                  <span>👁️ {ch.totalReads || 0}</span>
                  {ch.totalLikes > 0 && <span>❤️ {ch.totalLikes}</span>}
                  {ch.isMature && <span className="text-red-400 font-semibold">🔞 Mature</span>}
                </p>
              </div>
              {isCurrent && <span className="text-xs shrink-0 font-medium" style={{ color: 'var(--purple-light)' }}>● Reading</span>}
              {isRead && !isCurrent && <span className="text-base shrink-0" style={{ color: '#4ade80' }}>✓</span>}
            </Link>
          );
        })}
      </div>

      {/* Similar Stories */}
      {similarStories.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📚</span>
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--purple-light)' }}>
              Similar Stories
            </h3>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,rgba(147,51,234,0.4),transparent)' }} />
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
            {similarStories.map(s => (
              <Link key={s._id} to={`/story/${s._id}`}
                className="shrink-0 w-28 rounded-xl overflow-hidden glass-hover"
                style={{ border: '1px solid var(--border)' }}>
                <div className="aspect-[2/3]" style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
                  {s.coverImage ? (
                    <img src={optimizeImageUrl(s.coverImage, { width: 400 })} alt={s.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-1.5">
                      <p className="text-[10px] font-shayari text-center line-clamp-5" style={{ color: 'var(--text-secondary)' }}>
                        {s.title}
                      </p>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>by {s.author?.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Comments section */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Comments ({comments.length})
        </h2>

        <form onSubmit={handleComment} className="flex gap-3 mb-6">
          <Avatar user={user} size="sm" clickable={false} />
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
            <input
              ref={commentInputRef}
              value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
              maxLength={500}
            />
            {comment.trim() && (
              <button type="submit" disabled={submitting}
                className="text-xs font-semibold shrink-0 transition-all disabled:opacity-40"
                style={{ color: 'var(--purple-light)' }}>
                {submitting ? '...' : 'Post'}
              </button>
            )}
          </div>
        </form>

        <div className="space-y-4">
          {comments.length === 0 && (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No comments yet. Be the first!</p>
            </div>
          )}
          {comments.map((c, i) => (
            <div key={c._id || i} className="flex gap-3 animate-fade-in">
              <Avatar user={c.user} size="sm" />
              <div className="flex-1">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Link to={`/profile/${c.user?.username}`}
                      className="text-sm font-semibold hover:text-purple-300 transition-colors"
                      style={{ color: 'var(--text-primary)' }}>
                      {c.user?.username}
                    </Link>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {TimeAgo({ date: c.createdAt })}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{c.text}</p>
                </div>
                <div className="flex items-center gap-4 mt-1.5 px-1">
                  <button onClick={() => handleCommentLike(c._id)}
                    className="flex items-center gap-1 text-xs transition-all hover:scale-110">
                    <span>{c.liked ? '❤️' : '🤍'}</span>
                    <span style={{ color: c.liked ? '#f87171' : 'var(--text-muted)' }}>{c.likesCount || 0}</span>
                  </button>
                  {(user?._id === c.user?._id || isAuthor) && (
                    <button onClick={() => handleCommentDelete(c._id)}
                      className="text-xs transition-colors hover:text-red-400"
                      style={{ color: 'var(--text-muted)' }}>
                      🗑 Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}