import { useState, useRef, useEffect } from 'react';
import { optimizeImageUrl } from '../../utils/image';

// Theme + Font rendering helpers
const THEME_MAP = {
  classic: { bg:'#0e0e1a', text:'#f1f0ff', accent:'#9333ea' },
  purple:  { bg:'linear-gradient(135deg,#1a0533,#2d1058)', text:'#e9d5ff', accent:'#c084fc' },
  rose:    { bg:'linear-gradient(135deg,#1a0a0a,#3b0f0f)', text:'#fecaca', accent:'#f87171' },
  ocean:   { bg:'linear-gradient(135deg,#0a1628,#0f2d4a)', text:'#bae6fd', accent:'#38bdf8' },
  forest:  { bg:'linear-gradient(135deg,#071a0e,#0a2e18)', text:'#bbf7d0', accent:'#4ade80' },
  golden:  { bg:'linear-gradient(135deg,#1a1200,#3d2c00)', text:'#fde68a', accent:'#fbbf24' },
  midnight:{ bg:'linear-gradient(135deg,#000000,#0f0f23)', text:'#a5b4fc', accent:'#818cf8' },
  sunset:  { bg:'linear-gradient(135deg,#1a0a00,#3d1500)', text:'#fed7aa', accent:'#fb923c' },
  slate:   { bg:'linear-gradient(135deg,#0f172a,#1e293b)', text:'#cbd5e1', accent:'#94a3b8' },
  cherry:  { bg:'linear-gradient(135deg,#1a0010,#3b0020)', text:'#fda4af', accent:'#fb7185' },
  sage:    { bg:'linear-gradient(135deg,#0a1a12,#162b1e)', text:'#d1fae5', accent:'#6ee7b7' },
  cosmic:  { bg:'linear-gradient(135deg,#0d0520,#1a0a40)', text:'#e9d5ff', accent:'#a855f7' },
};
const FONT_MAP = {
  shayari:"'Playfair Display',serif", urdu:"'Noto Nastaliq Urdu',serif",
  modern:"'Poppins',sans-serif", elegant:"'Cormorant Garamond',serif",
  bold:"'Oswald',sans-serif", handwritten:"'Dancing Script',cursive",
  poetic:"'Lora',serif", minimal:"'Inter',sans-serif",
};
const getT = (t) => THEME_MAP[t] || THEME_MAP.classic;
const getF = (f) => FONT_MAP[f]  || FONT_MAP.shayari;

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { postAPI } from '../../services/api';
import Avatar from '../common/Avatar';

const CATEGORY_STYLES = {
  Love:         { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.3)',  color: '#f87171', emoji: '❤️' },
  Sad:          { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', color: '#60a5fa', emoji: '💧' },
  Motivational: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', color: '#fbbf24', emoji: '⚡' },
  Funny:        { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)', color: '#fb923c', emoji: '😄' },
  Spiritual:    { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', color: '#34d399', emoji: '🕊️' },
  Nature:       { bg: 'rgba(132,204,22,0.15)', border: 'rgba(132,204,22,0.3)', color: '#a3e635', emoji: '🌿' },
  Life:         { bg: 'rgba(147,51,234,0.15)', border: 'rgba(147,51,234,0.3)', color: '#c084fc', emoji: '✨' },
  Friendship:   { bg: 'rgba(20,184,166,0.15)', border: 'rgba(20,184,166,0.3)', color: '#2dd4bf', emoji: '🤝' },
  Patriotic:    { bg: 'rgba(255,165,0,0.15)',  border: 'rgba(255,165,0,0.3)',  color: '#ffa500', emoji: '🇮🇳' },
  Other:        { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', color: '#9ca3af', emoji: '📝' },
};

function TimeAgo({ date }) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return <span>just now</span>;
  if (mins < 60) return <span>{mins}m</span>;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return <span>{hrs}h</span>;
  const days = Math.floor(hrs / 24);
  if (days < 7) return <span>{days}d</span>;
  return <span>{new Date(date).toLocaleDateString()}</span>;
}

function ThemedContent({ post }) {
  const th  = getT(post.theme);
  const dir = post.writtenIn === 'Urdu' ? 'rtl' : 'ltr';
  return (
    <div className="mx-4 mb-3 rounded-xl overflow-hidden"
      style={{ background: th.bg, border: `1px solid ${th.accent}30` }}>
      <div className="pt-4 pb-1 text-center text-2xl select-none"
        style={{ color: th.accent, opacity: 0.35 }}>"</div>
      <p className="px-5 pb-4 text-center leading-relaxed text-base whitespace-pre-line"
        style={{ fontFamily: getF(post.fontStyle), color: th.text, direction: dir }}>
        {post.content}
      </p>
      <div className="h-0.5 mx-6 mb-3 rounded-full"
        style={{ background: `linear-gradient(90deg,transparent,${th.accent}60,transparent)` }} />
    </div>
  );
}

export default function PostCard({ post: initialPost, onDelete }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(initialPost);
  const [likedOverride, setLikedOverride] = useState(null);
  const [savedOverride, setSavedOverride] = useState(null);
  const liked  = likedOverride !== null ? likedOverride : (post.liked ?? false);
  const saved  = savedOverride !== null ? savedOverride : (post.saved ?? false);
  const [likeCount, setLikeCount] = useState(post.likesCount ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [commentsCount, setCommentsCount] = useState(post.commentsCount ?? 0);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsFetched, setCommentsFetched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  // ✅ FIX: loading locks — double click se duplicate requests nahi jayenge
  const [likeLoading, setLikeLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const lastTap = useRef(0);

  const cat = CATEGORY_STYLES[post.category] || CATEGORY_STYLES.Other;
  const isOwner = user?._id === post.author?._id;

  useEffect(() => {
    if (!showComments || commentsFetched) return;
    const load = async () => {
      setCommentsLoading(true);
      try {
        const { data } = await postAPI.getComments(post._id);
        setComments(data.comments || []);
        setCommentsFetched(true);
      } catch {}
      setCommentsLoading(false);
    };
    load();
  }, [showComments, post._id, commentsFetched]);

  // ✅ FIX: lock + backend response sync
  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    const wasLiked = liked;
    const previousCount = likeCount;
    setLikedOverride(!wasLiked);
    setLikeCount(prev => Math.max((prev || 0) + (wasLiked ? -1 : 1), 0));
    if (!wasLiked) {
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 600);
    }
    try {
      const { data } = await postAPI.toggleLike(post._id);
      setLikedOverride(!!data.liked);
      if (typeof data.likesCount === 'number') {
        setLikeCount(Math.max(data.likesCount, 0));
      }
    } catch {
      setLikedOverride(wasLiked);
      setLikeCount(previousCount);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300 && !liked) { handleLike(); }
    lastTap.current = now;
  };

  // ✅ FIX: lock + backend response sync
  const handleSave = async () => {
    if (saveLoading) return;
    setSaveLoading(true);
    const wasSaved = saved;
    setSavedOverride(!wasSaved);
    try {
      const { data } = await postAPI.toggleSave(post._id);
      setSavedOverride(!!data.saved);
    } catch {
      setSavedOverride(wasSaved);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await postAPI.addComment(post._id, comment.trim());
      if (data.comment) {
        setComments(prev => [...prev, data.comment]);
        setCommentsFetched(true);
      }
      setCommentsCount(prev => prev + 1);
      setComment('');
    } catch {}
    setSubmitting(false);
  };

  const handleReport = async () => {
    if (!confirm('Report this shayari as inappropriate?')) return;
    try {
      await postAPI.reportPost(post._id);
      alert('✅ Reported. Our team will review it.');
    } catch {}
    setShowMenu(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this shayari?')) return;
    try {
      await postAPI.deletePost(post._id);
      onDelete?.(post._id);
    } catch {}
    setShowMenu(false);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: post.title, text: post.content, url: window.location.origin + '/post/' + post._id });
    } else {
      navigator.clipboard.writeText(window.location.origin + '/post/' + post._id);
    }
  };

  return (
    <article className="card animate-fade-in mb-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          <Avatar user={post.author} size="md" ring />
          <div>
            <Link to={`/profile/${post.author?.username}`}
              className="font-semibold text-sm hover:text-purple-300 transition-colors"
              style={{ color: 'var(--text-primary)' }}>
              {post.author?.username}
            </Link>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}><TimeAgo date={post.createdAt} /></span>
              <span style={{ color: 'var(--border)' }}>·</span>
              {(post.categories || [post.category]).filter(Boolean).map(catName => {
                const c = CATEGORY_STYLES[catName] || CATEGORY_STYLES.Other;
                return (
                  <span key={catName} className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                    {c.emoji} {catName}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}>
            ···
          </button>
          {showMenu && (
            <div className="absolute right-0 top-9 glass-strong rounded-xl overflow-hidden z-20 min-w-32 shadow-2xl animate-fade-in">
              <button onClick={() => { navigate(`/post/${post._id}`); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}>View Post</button>
              <button onClick={handleShare}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}>Share</button>
              {!isOwner && (
                <button onClick={handleReport}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-yellow-500/10 transition-colors text-yellow-400">
                  Report
                </button>
              )}
              {isOwner && (
                <button onClick={handleDelete}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-500/10 transition-colors text-red-400">
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      {post.title && (
        <div className="px-4 pb-2">
          <h3 className="font-shayari text-sm font-semibold" style={{ color: 'var(--purple-light)' }}>
            {post.title}
          </h3>
        </div>
      )}

      {/* Content */}
      <div onClick={handleDoubleTap} className="cursor-pointer relative">
        {post.type === 'image' && post.image ? (
          <div className="relative">
            <img
              src={optimizeImageUrl(post.image, { width: 900 })}
              alt={post.title || 'Shayari'}
              className="w-full object-cover max-h-[500px]"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 flex items-end p-5"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)' }}>
              <p className={`font-shayari text-white text-lg leading-relaxed ${post.writtenIn === 'Urdu' ? 'font-urdu text-right w-full' : ''}`}>
                {post.content}
              </p>
            </div>
          </div>
        ) : (
          <ThemedContent post={post} />
        )}
        {heartAnim && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-6xl heart-animate">❤️</span>
          </div>
        )}
      </div>

      {/* Hashtags */}
      {post.hashtags?.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {post.hashtags.slice(0, 5).map(tag => (
            <Link key={tag} to={`/hashtag/${tag}`}
              className="text-xs px-2 py-0.5 rounded-full transition-all hover:bg-purple-500/20"
              style={{ color: 'var(--purple-light)', background: 'rgba(147,51,234,0.1)' }}>
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4">
          <button onClick={handleLike}
            disabled={likeLoading}
            className="flex items-center gap-1.5 group transition-all hover:scale-110 disabled:opacity-70">
            <span className={`text-xl transition-all ${liked ? 'scale-110' : 'opacity-60 group-hover:opacity-100'}`}>
              {liked ? '❤️' : '🤍'}
            </span>
            <span className="text-xs font-semibold" style={{ color: liked ? '#f87171' : 'var(--text-muted)', minWidth: '16px' }}>
              {likeCount > 0 ? likeCount : ''}
            </span>
          </button>

          <button onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 group transition-all hover:scale-110">
            <span className="text-xl opacity-60 group-hover:opacity-100">💬</span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {commentsCount > 0 ? commentsCount : ''}
            </span>
          </button>

          <button onClick={handleShare} className="flex items-center gap-1.5 group transition-all hover:scale-110">
            <span className="text-xl opacity-60 group-hover:opacity-100">🔗</span>
          </button>
        </div>

        <button onClick={handleSave}
          disabled={saveLoading}
          className="transition-all hover:scale-110 disabled:opacity-70">
          <span className={`text-xl ${saved ? '' : 'opacity-60 hover:opacity-100'}`}>
            {saved ? '🔖' : '🏷️'}
          </span>
        </button>
      </div>

      {/* Like count */}
      {likeCount > 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {likeCount} {likeCount === 1 ? 'like' : 'likes'}
          </p>
        </div>
      )}

      {/* Comments */}
      {showComments && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="pt-3 space-y-3 max-h-48 overflow-y-auto hide-scrollbar">
            {commentsLoading ? (
              <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
                Be the first to comment ✨
              </p>
            ) : (
              comments.map((c, i) => (
                <div key={c._id || i} className="flex gap-2 animate-fade-in">
                  <Avatar user={c.user} size="xs" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold mr-1.5" style={{ color: 'var(--text-primary)' }}>
                      {c.user?.username}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.text}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleComment} className="flex gap-2 items-center">
            <Avatar user={user} size="xs" clickable={false} />
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-600"
              style={{ color: 'var(--text-primary)' }}
              maxLength={500}
            />
            {comment.trim() && (
              <button type="submit" disabled={submitting}
                className="text-xs font-semibold transition-all hover:opacity-70 disabled:opacity-40"
                style={{ color: 'var(--purple-light)' }}>
                Post
              </button>
            )}
          </form>
        </div>
      )}
    </article>
  );
}