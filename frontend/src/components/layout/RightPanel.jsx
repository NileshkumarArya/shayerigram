import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userAPI, postAPI } from '../../services/api';
import Avatar from '../common/Avatar';

function FollowBtn({ userId, initialFollowing }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.toggleFollow(userId);
      // ✅ FIX: use the server's actual result — this button's initial
      // state is set once when the sidebar loads and never refreshed, so
      // it can go stale if the user follows the same person elsewhere.
      setFollowing(data.following);
    } catch {}
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
      style={following ? {
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      } : {
        background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
        color: 'white',
      }}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}

const CATEGORIES = [
  { name: 'Love',         emoji: '❤️',  color: '#ef4444' },
  { name: 'Sad',          emoji: '💧',  color: '#3b82f6' },
  { name: 'Motivational', emoji: '⚡',  color: '#f59e0b' },
  { name: 'Spiritual',    emoji: '🕊️', color: '#10b981' },
  { name: 'Poetry',       emoji: '🪶',  color: '#a855f7' },
  { name: 'Funny',        emoji: '😄',  color: '#f97316' },
];

export default function RightPanel() {
  const { user }            = useAuth();
  const navigate            = useNavigate();
  const location            = useLocation();
  const [searchParams]      = useSearchParams();
  const [suggestions, setSuggestions] = useState([]);
  const [trending, setTrending]       = useState([]);

  // ── Read active category from URL — auto-syncs with ExplorePage ─────────
  const isOnExplorePage = location.pathname === '/explore';
  const activeCategory  = isOnExplorePage ? (searchParams.get('category') || null) : null;

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t] = await Promise.all([
          userAPI.getSuggestions(),
          postAPI.getTrending(),
        ]);
        setSuggestions(s.data.users || []);
        setTrending(t.data.posts   || []);
      } catch {}
    };
    load();
  }, []);

  // ── Click handler — navigate to explore with category in URL ────────────
  const handleCategoryClick = (catName) => {
    navigate(`/explore?category=${catName}`);
  };

  return (
    <div className="space-y-4">
      {/* Current User */}
      {user && (
        <div className="flex items-center gap-3 p-3 rounded-xl glass">
          <Avatar user={user} size="md" ring />
          <div className="flex-1 min-w-0">
            <Link
              to={`/profile/${user.username}`}
              className="text-sm font-semibold hover:text-purple-300 transition-colors truncate block"
              style={{ color: 'var(--text-primary)' }}
            >
              {user.username}
            </Link>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {user.fullName || 'Shayar'}
            </p>
          </div>
          <Link to="/profile/edit" className="text-xs" style={{ color: 'var(--purple-light)' }}>Edit</Link>
        </div>
      )}

      {/* ── Categories — synced with ExplorePage via URL ─────────────────── */}
      <div className="glass rounded-2xl p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
          Categories
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => handleCategoryClick(cat.name)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl"
                style={{
                  background:  isActive ? `${cat.color}35` : `${cat.color}15`,
                  border:      isActive ? `2px solid ${cat.color}` : `1px solid ${cat.color}30`,
                  transform:   isActive ? 'scale(1.08)' : 'scale(1)',
                  boxShadow:   isActive ? `0 0 18px ${cat.color}45` : 'none',
                  transition:  'all 0.25s ease',
                  cursor:      'pointer',
                }}
              >
                <span style={{
                  fontSize:   '1.2rem',
                  transform:  isActive ? 'scale(1.25)' : 'scale(1)',
                  transition: 'transform 0.25s ease',
                  display:    'inline-block',
                }}>
                  {cat.emoji}
                </span>
                <span style={{
                  fontSize:    '0.7rem',
                  fontWeight:  isActive ? 700 : 500,
                  color:       cat.color,
                  transition:  'font-weight 0.2s',
                }}>
                  {cat.name}
                </span>

                {/* Active dot indicator */}
                <span style={{
                  width:      '5px',
                  height:     '5px',
                  borderRadius: '50%',
                  background: cat.color,
                  opacity:    isActive ? 1 : 0,
                  transition: 'opacity 0.25s ease',
                }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Suggested Shayars
            </h3>
            <Link to="/explore" className="text-xs font-semibold" style={{ color: 'var(--purple-light)' }}>
              See All
            </Link>
          </div>
          <div className="space-y-3">
            {suggestions.slice(0, 5).map((s, i) => (
              <div key={s._id} className={`flex items-center gap-3 animate-fade-in animate-stagger-${Math.min(i + 1, 5)}`}>
                <Avatar user={s} size="sm" />
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/profile/${s.username}`}
                    className="text-sm font-medium hover:text-purple-300 transition-colors truncate block"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {s.username}
                  </Link>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                   {s.followersCount || 0} followers
                  </p>
                </div>
                <FollowBtn userId={s._id} initialFollowing={false} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending */}
      {trending.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            🔥 Trending Shayari
          </h3>
          <div className="space-y-3">
            {trending.slice(0, 3).map(post => (
              <Link
                key={post._id}
                to={`/post/${post._id}`}
                className="block p-3 rounded-xl transition-all glass-hover"
                style={{ border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-shayari leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                  {post.content}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>❤️ {post.likes?.length || 0}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· #{post.category}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-center px-2 space-y-2" style={{ color: 'var(--text-muted)' }}>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
          <Link to="/policies/terms"     className="hover:text-purple-300 transition-colors">Terms</Link>
          <Link to="/policies/privacy"   className="hover:text-purple-300 transition-colors">Privacy</Link>
          <Link to="/policies/community" className="hover:text-purple-300 transition-colors">Guidelines</Link>
          <Link to="/policies/cookies"   className="hover:text-purple-300 transition-colors">Cookies</Link>
        </div>
        <p>© 2026 ShayeriGram · Made with ✦ for Shayars</p>
      </div>
    </div>
  );
}
