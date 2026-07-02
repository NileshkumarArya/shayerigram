import AdCard from '../components/feed/AdCard';
import StoryFeedCard from '../components/feed/StoryFeedCard';
import { useState, useEffect, useRef, useCallback } from 'react';
import { postAPI, storyAPI } from '../services/api';
import PostCard from '../components/feed/PostCard';
import CreatePostModal from '../components/feed/CreatePostModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FeedSkeleton } from '../components/common/Skeleton';

// Inserts a story card after every 5th post, using stories fetched once on load
function buildMixedFeed(posts, stories) {
  if (!stories.length) return posts;
  const mixed = [];
  let storyIdx = 0;
  posts.forEach((post, i) => {
    mixed.push(post);
    if ((i + 1) % 5 === 0 && storyIdx < stories.length) {
      mixed.push({ _id: `story-${stories[storyIdx]._id}`, type: 'story', story: stories[storyIdx] });
      storyIdx += 1;
    }
  });
  return mixed;
}

export default function HomePage() {
  const [tab,         setTab]         = useState('forYou'); // 'forYou' | 'shayari' | 'stories'
  const [posts,      setPosts]      = useState([]);
  const [stories,    setStories]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [hasMore,    setHasMore]    = useState(true);
  const [nextPage,   setNextPage]   = useState(2);
  const [showCreate, setShowCreate] = useState(false);
  const [error,      setError]      = useState('');
  const observerRef = useRef(null);
  const bottomRef   = useRef(null);

  // ─── Stories tab (full list, separate pagination) ───────────────────────
  const [storiesTabList,        setStoriesTabList]        = useState([]);
  const [storiesTabLoading,     setStoriesTabLoading]     = useState(true);
  const [storiesTabLoadingMore, setStoriesTabLoadingMore] = useState(false);
  const [storiesTabPage,        setStoriesTabPage]        = useState(1);
  const [storiesTabHasMore,     setStoriesTabHasMore]     = useState(true);
  const storiesObserverRef = useRef(null);
  const storiesBottomRef   = useRef(null);

  const loadPosts = useCallback(async (pageNum = 1, reset = false) => {
    if (reset) {
      setLoading(true);
      setError('');
    } else {
      setLoadingMore(true);
    }
    try {
      const params = { limit: 10, page: pageNum };
      // Send already-loaded post IDs so the Smart Feed doesn't repeat them
      if (!reset && posts.length > 0) {
        params.exclude = posts.map(p => p._id).filter(Boolean).join(',');
      }
      const { data } = await postAPI.getFeed(params);
      const newPosts = data.posts || [];

      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setHasMore(data.hasMore || false);
      setNextPage(data.nextPage || pageNum + 1);
    } catch {
      if (reset) setError('Feed load nahi ho paaya. Please try again.');
    }
    if (reset) setLoading(false); else setLoadingMore(false);
  }, [posts]);

  useEffect(() => { loadPosts(1, true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch a small batch of latest stories once, to mix into the "For You" feed
  useEffect(() => {
    storyAPI.getStories({ limit: 6, sort: 'latest' })
      .then(({ data }) => setStories(data.stories || []))
      .catch(() => {});
  }, []);

  // Posts infinite scroll — only active on 'forYou' and 'shayari' tabs
  useEffect(() => {
    if (tab === 'stories' || !bottomRef.current) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore && !loadingMore) {
        loadPosts(nextPage);
      }},
      { threshold: 0.1 }
    );
    observerRef.current.observe(bottomRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, nextPage, loadPosts, tab]);

  // ─── Stories tab: load full list, lazily on first switch ────────────────
  const loadStoriesTab = useCallback(async (pageNum = 1, reset = false) => {
    if (reset) setStoriesTabLoading(true); else setStoriesTabLoadingMore(true);
    try {
      const { data } = await storyAPI.getStories({ page: pageNum, limit: 10, sort: 'latest' });
      setStoriesTabList(prev => reset ? (data.stories || []) : [...prev, ...(data.stories || [])]);
      setStoriesTabHasMore(!!data.hasMore);
      setStoriesTabPage(pageNum);
    } catch (err) {
      console.error('Stories tab load error:', err);
    }
    if (reset) setStoriesTabLoading(false); else setStoriesTabLoadingMore(false);
  }, []);

  useEffect(() => {
    if (tab === 'stories' && storiesTabList.length === 0) {
      loadStoriesTab(1, true);
    }
  }, [tab, storiesTabList.length, loadStoriesTab]);

  // Stories tab infinite scroll — only active on 'stories' tab
  useEffect(() => {
    if (tab !== 'stories' || !storiesBottomRef.current) return;
    storiesObserverRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && storiesTabHasMore && !storiesTabLoadingMore) {
        loadStoriesTab(storiesTabPage + 1);
      }},
      { threshold: 0.1 }
    );
    storiesObserverRef.current.observe(storiesBottomRef.current);
    return () => storiesObserverRef.current?.disconnect();
  }, [tab, storiesTabHasMore, storiesTabLoadingMore, storiesTabPage, loadStoriesTab]);

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
        <button onClick={() => loadPosts(1, true)} className="btn-primary py-3 px-6">
          Try Again
        </button>
      </div>
    );
  }

  const feedItems = tab === 'forYou' ? buildMixedFeed(posts, stories) : posts;

  return (
    <div className="animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl glass mb-5 w-fit">
        {[
          { id: 'forYou',  label: '✨ For You' },
          { id: 'shayari', label: '📜 Shayari' },
          { id: 'stories', label: '📖 Stories' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab === t.id
              ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
              : { color: 'var(--text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* For You / Shayari tabs — share the same posts pagination */}
      {tab !== 'stories' && (
        posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 animate-float">📜</div>
            <p className="font-shayari text-lg gradient-text mb-2">Your feed is empty</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Follow some shayars to see their posts here
            </p>
          </div>
        ) : (
          <>
            {feedItems.map(item =>
              item.type === 'ad'    ? <AdCard key={item._id} ad={item} /> :
              item.type === 'story' ? <StoryFeedCard key={item._id} story={item.story} /> :
                                       <PostCard key={item._id} post={item} />
            )}
            <div ref={bottomRef} className="h-4" />
            {loadingMore && <div className="flex justify-center py-4"><LoadingSpinner /></div>}
            {!hasMore && posts.length > 0 && (
              <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                ✦ You've seen all shayaris
              </div>
            )}
          </>
        )
      )}

      {/* Stories tab — separate full list */}
      {tab === 'stories' && (
        storiesTabLoading ? (
          <FeedSkeleton count={4} />
        ) : storiesTabList.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 animate-float">📖</div>
            <p className="font-shayari text-lg gradient-text mb-2">No stories yet</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Be the first to publish one!
            </p>
          </div>
        ) : (
          <>
            {storiesTabList.map(s => <StoryFeedCard key={s._id} story={s} />)}
            <div ref={storiesBottomRef} className="h-4" />
            {storiesTabLoadingMore && <div className="flex justify-center py-4"><LoadingSpinner /></div>}
            {!storiesTabHasMore && storiesTabList.length > 0 && (
              <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                ✦ You've seen all stories
              </div>
            )}
          </>
        )
      )}

      {showCreate && (
        <CreatePostModal onClose={() => setShowCreate(false)} onPostCreated={handlePostCreated} />
      )}
    </div>
  );
}