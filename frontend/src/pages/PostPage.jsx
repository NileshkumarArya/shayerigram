import { optimizeImageUrl } from '../utils/image';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { postAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { PostPageSkeleton } from '../components/common/Skeleton';

const CATEGORY_STYLES = {
  Love:         { bg:'rgba(239,68,68,0.15)',  color:'#f87171', emoji:'❤️' },
  Sad:          { bg:'rgba(59,130,246,0.15)', color:'#60a5fa', emoji:'💧' },
  Motivational: { bg:'rgba(245,158,11,0.15)', color:'#fbbf24', emoji:'⚡' },
  Funny:        { bg:'rgba(249,115,22,0.15)', color:'#fb923c', emoji:'😄' },
  Spiritual:    { bg:'rgba(16,185,129,0.15)', color:'#34d399', emoji:'🕊️' },
  Nature:       { bg:'rgba(132,204,22,0.15)', color:'#a3e635', emoji:'🌿' },
  Life:         { bg:'rgba(147,51,234,0.15)', color:'#c084fc', emoji:'✨' },
  Friendship:   { bg:'rgba(20,184,166,0.15)', color:'#2dd4bf', emoji:'🤝' },
  Other:        { bg:'rgba(255,255,255,0.06)', color:'#9ca3af', emoji:'📝' },
};

function TimeAgo({ date }) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

export default function PostPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState([]);
  const [likeLoading, setLikeLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await postAPI.getPost(id);
        setPost(data.post);
        setLiked(data.post.liked ?? false);
        setLikeCount(data.post.likesCount ?? 0);
        setSaved(data.post.saved ?? false);
        const commentsRes = await postAPI.getComments(id);
        setComments(commentsRes.data.comments || []);
      } catch {
        setError('This shayari is unavailable.');
        setPost(null);
      }
      setLoading(false);
    };
    load();
  }, [id, user?._id]);

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    const wasLiked = liked;
    const previousCount = likeCount;
    setLiked(!wasLiked);
    setLikeCount(prev => Math.max((prev || 0) + (wasLiked ? -1 : 1), 0));
    try {
      const { data } = await postAPI.toggleLike(id);
      setLiked(!!data.liked);
      if (typeof data.likesCount === 'number') {
        setLikeCount(Math.max(data.likesCount, 0));
      }
    } catch {
      setLiked(wasLiked);
      setLikeCount(previousCount);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSave = async () => {
    if (saveLoading) return;
    setSaveLoading(true);
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      const { data } = await postAPI.toggleSave(id);
      setSaved(!!data.saved);
    } catch {
      setSaved(wasSaved);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    const text = comment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await postAPI.addComment(id, text);
      if (data.comment) {
        setComments(prev => {
          if (prev.some(c => c._id === data.comment._id)) return prev;
          return [...prev, data.comment];
        });
      }
      setComment('');
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this shayari?')) return;
    try { await postAPI.deletePost(id); navigate(-1); }
    catch {}
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: post?.title, text: post?.content, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (loading) return <PostPageSkeleton />;

  if (error) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm mb-4 hover:text-purple-300 transition-colors"
          style={{ color: 'var(--text-muted)' }}>
          ← Back
        </button>
        <div className="card text-center py-16 px-6">
          <div className="text-5xl mb-4">📜</div>
          <h1 className="text-xl font-shayari mb-2 gradient-text">Post unavailable</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {error}
          </p>
          <Link to="/" className="btn-primary inline-block py-3 px-6">
            Go to Feed
          </Link>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const cat = CATEGORY_STYLES[post.category] || CATEGORY_STYLES.Other;
  const isOwner = user?._id === post.author?._id;

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm mb-4 hover:text-purple-300 transition-colors"
        style={{ color: 'var(--text-muted)' }}>
        ← Back
      </button>

      <article className="card">
        {/* Author header */}
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <Avatar user={post.author} size="md" ring />
            <div>
              <Link to={`/profile/${post.author?.username}`}
                className="font-semibold hover:text-purple-300 transition-colors"
                style={{ color: 'var(--text-primary)' }}>
                {post.author?.username}
              </Link>
              {post.author?.fullName && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{post.author.fullName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full"
              style={{ background: cat.bg, color: cat.color }}>
              {cat.emoji} {post.category}
            </span>
            {isOwner && (
              <button onClick={handleDelete}
                className="text-xs px-3 py-1 rounded-full hover:bg-red-500/10 transition-all text-red-400">
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        {post.title && (
          <div className="px-5 pb-3">
            <h1 className="text-xl font-shayari font-semibold gradient-text">{post.title}</h1>
          </div>
        )}

        {/* Content */}
        {post.type === 'image' && post.image ? (
          <div className="relative">
            <img
              src={optimizeImageUrl(post.image, { width: 1100 })}
              alt={post.title || 'Shayari'}
              className="w-full object-cover max-h-[600px]"
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 flex items-end p-6"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 50%)' }}>
              <p className={`font-shayari text-white text-xl leading-loose ${post.writtenIn === 'Urdu' ? 'text-right w-full font-urdu' : ''}`}>
                {post.content}
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-5 mb-4 p-6 rounded-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(147,51,234,0.08), rgba(124,58,237,0.04))', border: '1px solid rgba(147,51,234,0.15)' }}>
            <div className="text-5xl opacity-20 font-cinzel mb-2 leading-none">"</div>
            <p className={`shayari-text text-lg ${post.writtenIn === 'Urdu' ? 'shayari-text-urdu' : ''}`}>
              {post.content}
            </p>
            <div className="text-5xl opacity-20 font-cinzel mt-3 leading-none text-right">"</div>
          </div>
        )}

        {/* Meta */}
        <div className="px-5 pb-3 flex flex-wrap items-center gap-3">
          {post.writtenIn && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background:'rgba(255,255,255,0.06)', color:'var(--text-muted)', border:'1px solid var(--border)' }}>
              {post.writtenIn}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {TimeAgo({ date: post.createdAt })}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {post.views || 0} views
          </span>
        </div>

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <div className="px-5 pb-4 flex flex-wrap gap-2">
            {post.hashtags.map(tag => (
              <Link key={tag} to={`/hashtag/${tag}`}
                className="text-xs px-3 py-1 rounded-full transition-all hover:bg-purple-500/20"
                style={{ color: 'var(--purple-light)', background: 'rgba(147,51,234,0.1)' }}>
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
          <div className="flex items-center gap-5">
            <button onClick={handleLike} disabled={likeLoading}
              className="flex items-center gap-2 transition-all hover:scale-110 group disabled:opacity-60">
              <span className="text-2xl">{liked ? '❤️' : '🤍'}</span>
              <span className="text-sm font-semibold" style={{ color: liked ? '#f87171' : 'var(--text-muted)' }}>
                {likeCount}
              </span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">💬</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                {comments.length}
              </span>
            </div>
            <button onClick={handleShare} className="text-2xl transition-all hover:scale-110">🔗</button>
          </div>
          <button onClick={handleSave} disabled={saveLoading}
            className="text-2xl transition-all hover:scale-110 disabled:opacity-60">
            {saved ? '🔖' : '🏷️'}
          </button>
        </div>

        {/* Comments section */}
        <div className="p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>
            Comments ({comments.length})
          </h3>

          {/* Comment input */}
          <form onSubmit={handleComment} className="flex gap-3 mb-6">
            <Avatar user={user} size="sm" clickable={false} />
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)' }}>
              <input
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

          {/* Comments list */}
          <div className="space-y-4">
            {comments.length === 0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-sm" style={{ color:'var(--text-muted)' }}>No comments yet. Be the first!</p>
              </div>
            )}
            {comments.map((c, i) => (
              <div key={c._id || i} className="flex gap-3 animate-fade-in">
                <Avatar user={c.user} size="sm" />
                <div className="flex-1">
                  <div className="p-3 rounded-xl" style={{ background:'rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/profile/${c.user?.username}`}
                        className="text-sm font-semibold hover:text-purple-300 transition-colors"
                        style={{ color: 'var(--text-primary)' }}>
                        {c.user?.username}
                      </Link>
                      <span className="text-xs" style={{ color:'var(--text-muted)' }}>
                        {TimeAgo({ date: c.createdAt })}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color:'var(--text-secondary)' }}>{c.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}