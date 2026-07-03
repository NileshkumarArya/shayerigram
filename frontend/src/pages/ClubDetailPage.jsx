import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { clubAPI, postAPI } from '../services/api';
import PostCard from '../components/feed/PostCard';
import CreatePostModal from '../components/feed/CreatePostModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FeedSkeleton } from '../components/common/Skeleton';

export default function ClubDetailPage() {
  const { clubId } = useParams();
  const [club,        setClub]        = useState(null);
  const [isMember,    setIsMember]    = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [posts,       setPosts]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [nextCursor,  setNextCursor]  = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const bottomRef   = useRef(null);
  const observerRef = useRef(null);

  const loadPosts = useCallback(async (cursor = null, reset = false) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const { data } = await clubAPI.getClubPosts(clubId, cursor ? { cursor } : {});
      setPosts(prev => reset ? (data.posts || []) : [...prev, ...(data.posts || [])]);
      setHasMore(!!data.hasMore);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error('Club posts load error:', err);
    }
    if (reset) setLoading(false); else setLoadingMore(false);
  }, [clubId]);

  useEffect(() => {
    clubAPI.getClub(clubId)
      .then(({ data }) => { setClub(data.club); setIsMember(data.isMember); })
      .catch(err => console.error('Club load error:', err));
    loadPosts(null, true);
  }, [clubId, loadPosts]);

  useEffect(() => {
    if (!bottomRef.current) return;
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore && nextCursor) {
        loadPosts(nextCursor);
      }
    }, { threshold: 0.1 });
    observerRef.current.observe(bottomRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, nextCursor, loadPosts]);

  const handleJoinToggle = async () => {
    if (joinLoading) return;
    setJoinLoading(true);
    const wasMember = isMember;
    setIsMember(!wasMember);
    setClub(prev => ({ ...prev, membersCount: (prev.membersCount || 0) + (wasMember ? -1 : 1) }));
    try {
      const { data } = await clubAPI.toggleMembership(clubId);
      setIsMember(!!data.isMember);
      setClub(prev => ({ ...prev, membersCount: data.membersCount }));
    } catch (err) {
      setIsMember(wasMember);
      setClub(prev => ({ ...prev, membersCount: (prev.membersCount || 0) + (wasMember ? 1 : -1) }));
      if (err.response?.data?.message) alert(err.response.data.message);
    } finally {
      setJoinLoading(false);
    }
  };

  if (!club) return <FeedSkeleton count={2} />;

  return (
    <div className="animate-fade-in w-full min-w-0">
      {/* Club header */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid var(--border)' }}>
        <div className="h-32 flex items-center justify-center text-4xl"
          style={{ background: club.coverImage ? undefined : 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
          {club.coverImage
            ? <img src={club.coverImage} alt={club.name} className="w-full h-full object-cover" />
            : club.emoji}
        </div>
        <div className="p-5 glass">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{club.emoji} {club.name}</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{club.description}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                👥 {club.membersCount} members · 📝 {club.postsCount} posts · started by {club.createdBy?.username}
              </p>
            </div>
            <button onClick={handleJoinToggle} disabled={joinLoading}
              className="px-4 py-2 rounded-xl text-sm font-semibold shrink-0 transition-all disabled:opacity-60"
              style={isMember
                ? { background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                : { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }}>
              {isMember ? 'Joined ✓' : 'Join Club'}
            </button>
          </div>
        </div>
      </div>

      {isMember && (
        <button onClick={() => setShowCreate(true)}
          className="w-full mb-5 py-3 rounded-xl text-sm font-semibold glass-hover text-left px-4"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          ✨ Is club me shayari share karo...
        </button>
      )}

      {/* Posts */}
      {loading ? (
        <FeedSkeleton count={3} />
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📝</div>
          <p className="font-shayari gradient-text">Is club me abhi koi post nahi hai</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isMember ? 'Pehli post tu daal!' : 'Join karke pehli post daalo'}
          </p>
        </div>
      ) : (
        <>
          {posts.map(p => <PostCard key={p._id} post={p} />)}
          <div ref={bottomRef} className="h-4" />
          {loadingMore && <div className="flex justify-center py-4"><LoadingSpinner /></div>}
        </>
      )}

      {showCreate && (
        <CreatePostModal
          clubId={clubId}
          onClose={() => setShowCreate(false)}
          onPostCreated={(newPost) => { setPosts(prev => [newPost, ...prev]); setShowCreate(false); }}
        />
      )}
    </div>
  );
}