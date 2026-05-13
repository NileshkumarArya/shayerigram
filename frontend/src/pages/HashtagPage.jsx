import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { exploreAPI } from '../services/api';
import PostCard from '../components/feed/PostCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function HashtagPage() {
  const { tag } = useParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await exploreAPI.getHashtag(tag);
        setPosts(data.posts || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, [tag]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/explore" className="w-9 h-9 rounded-xl flex items-center justify-center glass hover:border-purple-500/40 transition-all"
            style={{ color: 'var(--text-muted)' }}>←</Link>
          <div>
            <h1 className="text-2xl font-cinzel gradient-text">#{tag}</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {posts.length} {posts.length === 1 ? 'post' : 'posts'}
            </p>
          </div>
        </div>

        {/* Tag hero card */}
        <div className="glass rounded-2xl p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: 'linear-gradient(135deg, rgba(147,51,234,0.2), rgba(124,58,237,0.1))', border: '1px solid rgba(147,51,234,0.3)' }}>
            #
          </div>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>#{tag}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{posts.length} shayari</p>
          </div>
        </div>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center pt-10"><LoadingSpinner size="lg" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4 animate-float">#</div>
          <h3 className="text-lg font-shayari mb-2 gradient-text">No shayari yet</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Be the first to use #{tag}
          </p>
          <Link to="/create" className="btn-primary inline-block py-3 px-6">Create Post</Link>
        </div>
      ) : (
        <div>
          {posts.map(post => (
            <PostCard key={post._id} post={post} onDelete={(id) => setPosts(p => p.filter(x => x._id !== id))} />
          ))}
        </div>
      )}
    </div>
  );
}
