import { optimizeImageUrl } from '../utils/image';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import Avatar from '../components/common/Avatar';
import PostCard from '../components/feed/PostCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { ProfileSkeleton } from '../components/common/Skeleton';

function StatItem({ label, value, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 group">
      <span className="text-xl font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>{value}</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </button>
  );
}

function PostGrid({ posts }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {posts.map((post, i) => (
        <Link key={post._id} to={`/post/${post._id}`}
          className={`relative aspect-square overflow-hidden group animate-fade-in animate-stagger-${Math.min(i % 5 + 1, 5)}`}
          style={{ borderRadius: '8px' }}>
          {post.type === 'image' && post.image ? (
            <img
              src={optimizeImageUrl(post.image, { width: 420, height: 420, crop: 'fill' })}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-2 transition-all duration-300 group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)', border: '1px solid rgba(147,51,234,0.15)' }}>
              <p className="text-xs font-shayari text-center leading-relaxed line-clamp-4"
                style={{ color: 'var(--text-secondary)' }}>{post.content}</p>
            </div>
          )}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <span className="text-white text-xs font-semibold flex items-center gap-1">❤️ {post.likesCount || 0}</span>
            <span className="text-white text-xs font-semibold flex items-center gap-1">💬 {post.commentsCount || 0}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [view, setView] = useState('grid');
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const isMe = me?.username === username;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [p, postsRes] = await Promise.all([
          userAPI.getProfile(username),
          userAPI.getUserPosts(username)
        ]);
        setProfile(p.data.user);
        setPosts(postsRes.data.posts || []);
        setFollowing(p.data.user.isFollowing ?? false);
      } catch {
        setProfile(null);
        setPosts([]);
        setError('Profile load nahi ho paaya. Please try again.');
      }
      setLoading(false);
    };
    load();
  }, [username, me?._id]);

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      await userAPI.toggleFollow(profile._id);
      setFollowing(!following);
      setProfile(prev => ({
        ...prev,
        followersCount: (prev.followersCount ?? 0) + (following ? -1 : 1),
        isFollowing: !following
      }));
    } catch {}
    setFollowLoading(false);
  };

  if (loading) return <ProfileSkeleton />;

  if (error) {
    return (
      <div className="card text-center py-16 px-6 animate-fade-in">
        <div className="text-5xl mb-4">👤</div>
        <h2 className="text-xl font-shayari mb-2 gradient-text">Profile unavailable</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          {error}
        </p>
        <button onClick={() => window.location.reload()} className="btn-primary py-3 px-6">
          Try Again
        </button>
      </div>
    );
  }

  if (!profile) return (
    <div className="text-center py-20">
      <div className="text-5xl mb-4">👻</div>
      <h3 className="text-xl font-semibold mb-2">User not found</h3>
      <p style={{ color: 'var(--text-muted)' }}>This shayar doesn't exist</p>
    </div>
  );

  const CATEGORY_COLORS = {
    Love: '#f87171', Sad: '#60a5fa', Motivational: '#fbbf24',
    Funny: '#fb923c', Spiritual: '#34d399', Nature: '#a3e635',
    Life: '#c084fc', Friendship: '#2dd4bf', Other: '#9ca3af'
  };

  const categoryCounts = posts.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1; return acc;
  }, {});

  return (
    <div className="animate-fade-in">
      {/* Profile header */}
      <div className="card mb-4 p-6">
        <div className="flex items-start gap-6">
          <Avatar user={profile} size="xl" ring={following} clickable={false} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{profile.username}</h1>
              {profile.isVerified && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(147,51,234,0.2)', color: 'var(--purple-light)', border: '1px solid rgba(147,51,234,0.3)' }}>✓ Verified</span>}
            </div>
            {profile.fullName && <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{profile.fullName}</p>}

            <div className="flex gap-6 mb-4">
              <StatItem label="posts" value={posts.length} />
              <StatItem label="followers" value={profile.followersCount ?? 0} onClick={() => setShowFollowers(true)} />
              <StatItem label="following" value={profile.followingCount ?? 0} onClick={() => setShowFollowing(true)} />
            </div>

            {isMe ? (
              <Link to="/profile/edit" className="btn-ghost text-sm py-2 px-5 inline-block">Edit Profile</Link>
            ) : (
            <div className="flex gap-2">
                <button onClick={handleFollow} disabled={followLoading}
                  className={following ? 'btn-ghost text-sm py-2 px-5' : 'btn-primary text-sm py-2 px-5'}>
                  {followLoading ? '...' : following ? 'Following' : 'Follow'}
                </button>
                <Link to={`/chat`} state={{ userId: profile._id }}
                 className="btn-ghost text-sm py-2 px-5">
                 💬 Message
                </Link>
            </div>
            )}
          </div>
        </div>

        {profile.bio && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-sm font-shayari leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{profile.bio}</p>
          </div>
        )}

        {profile.website && (
          <a href={profile.website} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs hover:opacity-80" style={{ color: 'var(--purple-light)' }}>
            🔗 {profile.website.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>

      {/* Category breakdown */}
      {Object.keys(categoryCounts).length > 0 && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4 pb-1">
          {Object.entries(categoryCounts).sort((a,b) => b[1]-a[1]).map(([cat, count]) => (
            <div key={cat} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: `${CATEGORY_COLORS[cat] || '#9ca3af'}15`, border: `1px solid ${CATEGORY_COLORS[cat] || '#9ca3af'}30`, color: CATEGORY_COLORS[cat] || '#9ca3af' }}>
              {cat} · {count}
            </div>
          ))}
        </div>
      )}

      {/* View toggle */}
      <div className="flex gap-1 p-1 rounded-xl mb-4 w-fit glass">
        {[['grid', '⊞'], ['list', '☰']].map(([v, icon]) => (
          <button key={v} onClick={() => setView(v)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={view === v ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
              : { color: 'var(--text-muted)' }}>
            {icon} {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">📜</div>
          <h3 className="text-lg font-shayari mb-2" style={{ color: 'var(--text-secondary)' }}>No shayari yet</h3>
          {isMe && <Link to="/create" className="btn-primary inline-block text-sm py-2.5 px-6 mt-2">Write your first shayari</Link>}
        </div>
      ) : view === 'grid' ? (
        <PostGrid posts={posts} />
      ) : (
        <div className="space-y-4">
          {posts.map(post => <PostCard key={post._id} post={post} onDelete={id => setPosts(p => p.filter(x => x._id !== id))} />)}
        </div>
      )}

      {/* Followers/Following modals */}
      {(showFollowers || showFollowing) && (
        <UserListModal
          title={showFollowers ? 'Followers' : 'Following'}
          userId={profile?._id}
          username={profile?.username}
          type={showFollowers ? 'followers' : 'following'}
          onClose={() => { setShowFollowers(false); setShowFollowing(false); }}
        />
      )}
    </div>
  );
}

function UserListModal({ title, userId, username, type, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (!username) return;
        const { data } = type === 'followers'
          ? await userAPI.getFollowers(username)
          : await userAPI.getFollowing(username);
        setUsers(data.users || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, [userId, type]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="glass rounded-2xl w-full max-w-sm overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto hide-scrollbar">
          {loading ? <LoadingSpinner /> : users.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No {title.toLowerCase()} yet</p>
          ) : users.map(u => (
            <Link key={u._id || u} to={`/profile/${u.username || u}`} onClick={onClose}
              className="flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity">
              <Avatar user={u} size="sm" clickable={false} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{u.username || u}</p>
                {u.fullName && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.fullName}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}