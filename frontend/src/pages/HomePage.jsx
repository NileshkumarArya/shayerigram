import AdCard from '../components/feed/AdCard';
import { useState, useEffect, useRef, useCallback } from 'react';
import { postAPI } from '../services/api';
import PostCard from '../components/feed/PostCard';
import CreatePostModal from '../components/feed/CreatePostModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FeedSkeleton } from '../components/common/Skeleton';

export default function HomePage() {
  const [posts,      setPosts]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [hasMore,    setHasMore]    = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error,      setError]      = useState('');
  const observerRef = useRef(null);
  const bottomRef   = useRef(null);

  const loadPosts = useCallback(async (cursor = null, reset = false) => {
    if (reset) {
      setLoading(true);
      setError('');
    } else {
      setLoadingMore(true);
    }
    try {
      const params = { limit: 10 };
      if (cursor) params.cursor = cursor;
      const { data } = await postAPI.getFeed(params);
      const newPosts = data.posts || [];

      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setHasMore(data.hasMore || false);
      setNextCursor(data.nextCursor || null);
    } catch {
      if (reset) setError('Feed load nahi ho paaya. Please try again.');
    }
    if (reset) setLoading(false); else setLoadingMore(false);
  }, []);

  useEffect(() => { loadPosts(null, true); }, [loadPosts]);

  useEffect(() => {
    if (!bottomRef.current) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore && !loadingMore && nextCursor) {
        loadPosts(nextCursor);
      }},
      { threshold: 0.1 }
    );
    observerRef.current.observe(bottomRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, nextCursor, loadPosts]);

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
    setShowCreate(false);
  };

  if (loading) return <FeedSkeleton count={4} />;

  if (error) {
    return (
      <div className="card text-center py-16 px-6 animate-fade-in">
        <div className="text-5xl mb-4">📜</div>
        <h2 className="text-xl font-shayari mb-2 gradient-text">Feed unavailable</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          {error}
        </p>
        <button onClick={() => loadPosts(null, true)} className="btn-primary py-3 px-6">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4 animate-float">📜</div>
          <p className="font-shayari text-lg gradient-text mb-2">Your feed is empty</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Follow some shayars to see their posts here
          </p>
        </div>
      ) : (
        <>
          {posts.map(item =>
            item.type === 'ad'
              ? <AdCard key={item._id} ad={item} />
              : <PostCard key={item._id} post={item} />
          )}
          <div ref={bottomRef} className="h-4" />
          {loadingMore && <div className="flex justify-center py-4"><LoadingSpinner /></div>}
          {!hasMore && posts.length > 0 && (
            <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              ✦ You've seen all shayaris
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreatePostModal onClose={() => setShowCreate(false)} onPostCreated={handlePostCreated} />
      )}
    </div>
  );
}