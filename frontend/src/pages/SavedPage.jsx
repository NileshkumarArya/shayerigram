import { optimizeImageUrl } from '../utils/image';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { userAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const CATEGORY_COLORS = {
  Love:'#f87171', Sad:'#60a5fa', Motivational:'#fbbf24', Funny:'#fb923c',
  Spiritual:'#34d399', Nature:'#a3e635', Life:'#c084fc', Friendship:'#2dd4bf',
  Patriotic:'#ffa500', Other:'#9ca3af',
};

function SavedPostCard({ post }) {
  return (
    <Link to={`/post/${post._id}`}
      className="group relative aspect-square overflow-hidden rounded-xl transition-all hover:scale-[1.02] animate-fade-in"
      style={{ border: '1px solid var(--border)' }}>
      {post.type === 'image' && post.image ? (
        <>
         <img
  src={optimizeImageUrl(post.image, { width: 420, height: 420, crop: 'fill' })}
  alt=""
  className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
  loading="lazy"
  decoding="async"
/>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            <p className="text-white text-xs font-shayari text-center line-clamp-4 leading-relaxed">{post.content}</p>
            <span className="text-white text-xs flex items-center gap-1">❤️ {post.likesCount ?? 0}</span>
          </div>
        </>
      ) : (
        <>
          <div className="w-full h-full flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
            <div>
              <div className="text-2xl mb-2 text-center opacity-30 font-shayari">"</div>
              <p className="text-xs font-shayari text-center leading-relaxed line-clamp-5"
                style={{ color: 'var(--text-secondary)' }}>{post.content}</p>
            </div>
          </div>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
            <span className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: `${CATEGORY_COLORS[post.category] || '#9ca3af'}20`, color: CATEGORY_COLORS[post.category] || '#9ca3af' }}>
              {post.category}
            </span>
            <div className="flex gap-3">
              <span className="text-white text-xs">❤️ {post.likesCount ?? 0}</span>
              <span className="text-white text-xs">💬 {post.commentsCount ?? 0}</span>
            </div>
          </div>
        </>
      )}
      {/* Category dot */}
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full"
        style={{ background: CATEGORY_COLORS[post.category] || '#9ca3af', boxShadow: `0 0 6px ${CATEGORY_COLORS[post.category] || '#9ca3af'}` }} />
    </Link>
  );
}

export default function SavedPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await userAPI.getSavedPosts();
        setPosts(data.posts || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const categories = ['All', ...new Set(posts.map(p => p.category))];
  const filtered = filter === 'All' ? posts : posts.filter(p => p.category === filter);

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-cinzel gradient-text">Saved Shayari</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {posts.length} {posts.length === 1 ? 'poem' : 'poems'} saved
        </p>
      </div>

      {/* Category filter */}
      {posts.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto hide-scrollbar pb-1">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={filter === cat ? {
                background: 'linear-gradient(135deg,#9333ea,#7c3aed)',
                color: 'white',
              } : {
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="text-center py-20 animate-fade-in">
          <div className="text-6xl mb-4 animate-float">🔖</div>
          <h3 className="text-lg font-shayari mb-2 gradient-text">Nothing saved yet</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Tap the 🔖 on any shayari to save it here
          </p>
          <Link to="/" className="btn-primary inline-block py-3 px-6">Browse Feed</Link>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {filtered.map(post => <SavedPostCard key={post._id} post={post} />)}
        </div>
      )}
    </div>
  );
}
