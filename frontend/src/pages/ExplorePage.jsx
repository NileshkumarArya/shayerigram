import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { exploreAPI, userAPI, storyAPI } from '../services/api';
import Avatar from '../components/common/Avatar';
import PostCard from '../components/feed/PostCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { ExploreSkeleton, FeedSkeleton } from '../components/common/Skeleton';

const CATEGORIES = [
  { name: 'All',          emoji: '✨', color: '#9333ea' },
  { name: 'Love',         emoji: '❤️', color: '#ef4444' },
  { name: 'Sad',          emoji: '💧', color: '#3b82f6' },
  { name: 'Motivational', emoji: '⚡', color: '#f59e0b' },
  { name: 'Spiritual',    emoji: '🕊️', color: '#10b981' },
  { name: 'Nature',       emoji: '🌿', color: '#84cc16' },
  { name: 'Funny',        emoji: '😄', color: '#f97316' },
  { name: 'Life',         emoji: '🌙', color: '#8b5cf6' },
  { name: 'Poetry',       emoji: '🪶', color: '#a855f7' },
  { name: 'Friendship',   emoji: '🤝', color: '#06b6d4' },
];

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') || 'All';

  const [contentTab, setContentTab] = useState('shayari'); // 'shayari' | 'stories'
  const [query,         setQuery]         = useState('');
  const [searchType,    setSearchType]    = useState('all');
  const [results,       setResults]       = useState({ posts: [], users: [] });
  const [posts,         setPosts]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [hasMore,       setHasMore]       = useState(false);
  const [nextCursor,    setNextCursor]    = useState(null);
  const [searched,      setSearched]      = useState(false);
  const [error,         setError]         = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef(null);
  const bottomRef   = useRef(null);
  const observerRef = useRef(null);

  const loadPosts = useCallback(async (cursor = null, reset = false) => {
    if (reset) {
      setLoading(true);
      setError('');
    } else {
      setLoadingMore(true);
    }
    try {
      const params = { limit: 15 };
      if (cursor) params.cursor = cursor;

      let data;
      if (activeCategory === 'All') {
        const res = await exploreAPI.getAllPosts(params);
        data = res.data;
      } else {
        const res = await exploreAPI.getCategory(activeCategory, params);
        data = res.data;
      }

      const newPosts = data.posts || [];
      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setHasMore(data.hasMore || false);
      setNextCursor(data.nextCursor || null);
    } catch {
      if (reset) setError('Explore load nahi ho paaya. Please try again.');
    }
    if (reset) setLoading(false); else setLoadingMore(false);
  }, [activeCategory]);

  useEffect(() => {
    if (searched) return;
    setPosts([]);
    setNextCursor(null);
    loadPosts(null, true);
  }, [activeCategory, searched, loadPosts]);

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

  useEffect(() => {
    if (!query.trim()) {
      setSearched(false);
      setResults({ posts: [], users: [] });
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearched(true);
      setSearchLoading(true);
      try {
        const { data } = await exploreAPI.search(query, searchType);
        setResults({ posts: data.posts || [], users: data.users || [] });
      } catch {
        setResults({ posts: [], users: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, searchType]);

  const handleCategory = (name) => {
    setSearched(false);
    setQuery('');
    if (name === 'All') setSearchParams({});
    else setSearchParams({ category: name });
  };

  const activeCat = CATEGORIES.find(c => c.name === activeCategory) || CATEGORIES[0];

  return (
    <div className="animate-fade-in w-full min-w-0">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-cinzel gradient-text mb-1">Explore</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Discover shayaris and poets</p>
      </div>

      {/* Content type tabs */}
      <div className="flex gap-1 p-1 rounded-xl glass mb-5 w-fit">
        {[{ id: 'shayari', label: '📜 Shayari' }, { id: 'stories', label: '📖 Stories' }].map(t => (
          <button key={t.id} onClick={() => setContentTab(t.id)}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={contentTab === t.id
              ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
              : { color: 'var(--text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {contentTab === 'shayari' && (
      <>
      {/* Search bar */}
      <div className="relative mb-4">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search shayari, poets, hashtags..."
          className="input-field" style={{ paddingLeft: '2.75rem' }} />
        {query && (
          <button onClick={() => { setQuery(''); setSearched(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">✕</button>
        )}
      </div>

      {/* Search type tabs */}
      {query && (
        <div className="flex gap-1 p-1 rounded-xl glass mb-4 w-fit">
          {['all', 'posts', 'users'].map(t => (
            <button key={t} onClick={() => setSearchType(t)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={searchType === t
                ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
                : { color: 'var(--text-muted)' }}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Category chips */}
      {!query && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-5 w-full">
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.name;
            return (
              <button key={cat.name} onClick={() => handleCategory(cat.name)}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all"
                style={{
                  background: isActive ? cat.color : 'rgba(255,255,255,0.05)',
                  color:      isActive ? 'white'   : 'var(--text-secondary)',
                  border:     isActive ? 'none'    : '1px solid var(--border)',
                  transform:  isActive ? 'scale(1.05)' : 'scale(1)',
                  boxShadow:  isActive ? `0 4px 15px ${cat.color}50` : 'none',
                }}>
                <span>{cat.emoji}</span>{cat.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Search results */}
      {searched && (
        <div>
          {searchLoading ? (
            <FeedSkeleton count={2} />
          ) : (
            <>
              {results.users.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold uppercase tracking-widest mb-3"
                    style={{ color: 'var(--text-muted)' }}>Poets</h3>
                  <div className="space-y-2">
                    {results.users.map(u => (
                      <Link key={u._id} to={`/profile/${u.username}`}
                        className="flex items-center gap-3 p-3 rounded-xl glass-hover"
                        style={{ border: '1px solid var(--border)' }}>
                        <Avatar user={u} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{u.username}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.followersCount || 0} followers</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {results.posts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest mb-3"
                    style={{ color: 'var(--text-muted)' }}>Shayari</h3>
                  {results.posts.map(p => <PostCard key={p._id} post={p} />)}
                </div>
              )}

              {results.posts.length === 0 && results.users.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">🔍</div>
                  <p className="gradient-text font-shayari text-lg">No results found</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Category posts */}
      {!searched && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">{activeCat.emoji}</span>
            <h3 className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: activeCat.color }}>
              {activeCategory === 'All' ? 'Recent Shayari' : `${activeCategory} Shayari`}
            </h3>
            <div className="flex-1 h-px"
              style={{ background: `linear-gradient(90deg,${activeCat.color}60,transparent)` }} />
          </div>

          {loading ? (
            <FeedSkeleton count={3} />
          ) : error ? (
            <div className="card text-center py-16 px-6">
              <div className="text-5xl mb-4">📜</div>
              <h2 className="text-xl font-shayari mb-2 gradient-text">Explore unavailable</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                {error}
              </p>
              <button onClick={() => loadPosts(null, true)} className="btn-primary py-3 px-6">
                Try Again
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📜</div>
              <p className="font-shayari gradient-text">No shayari yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Be the first to share!
              </p>
            </div>
          ) : (
            <>
              {posts.map(p => <PostCard key={p._id} post={p} />)}
              <div ref={bottomRef} className="h-4" />
              {loadingMore && <div className="flex justify-center py-4"><LoadingSpinner /></div>}
              {!hasMore && posts.length > 0 && (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                  ✦ You've seen all shayaris
                </div>
              )}
            </>
          )}
        </div>
      )}
      </>
      )}

      {contentTab === 'stories' && <StoriesExplore />}
    </div>
  );
}

const STORY_GENRES = [
  { name: 'All',        emoji: '✨', color: '#9333ea' },
  { name: 'Love',       emoji: '❤️', color: '#ef4444' },
  { name: 'Sad',        emoji: '💧', color: '#3b82f6' },
  { name: 'Horror',     emoji: '👻', color: '#7c3aed' },
  { name: 'Motivation', emoji: '⚡', color: '#f59e0b' },
  { name: 'Comedy',     emoji: '😄', color: '#f97316' },
  { name: 'Thriller',   emoji: '🔪', color: '#dc2626' },
  { name: 'Fantasy',    emoji: '🐉', color: '#8b5cf6' },
  { name: 'Poetry',     emoji: '🪶', color: '#a855f7' },
  { name: 'Spiritual',  emoji: '🕊️', color: '#10b981' },
  { name: 'Biography',  emoji: '📘', color: '#06b6d4' },
  { name: 'Other',      emoji: '📝', color: '#9ca3af' },
];

function StoriesExplore() {
  const [genre, setGenre] = useState('All');
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const bottomRef = useRef(null);
  const observerRef = useRef(null);

  const loadStories = useCallback(async (pageNum = 1, reset = false) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const params = { page: pageNum, limit: 12, sort: 'latest' };
      if (genre !== 'All') params.genre = genre;
      const { data } = await storyAPI.getStories(params);
      setStories(prev => reset ? (data.stories || []) : [...prev, ...(data.stories || [])]);
      setHasMore(!!data.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Stories load error:', err);
    }
    if (reset) setLoading(false); else setLoadingMore(false);
  }, [genre]);

  useEffect(() => {
    setStories([]);
    loadStories(1, true);
  }, [genre, loadStories]);

  useEffect(() => {
    if (!bottomRef.current) return;
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore) {
        loadStories(page + 1);
      }
    }, { threshold: 0.1 });
    observerRef.current.observe(bottomRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, page, loadStories]);

  const activeGenre = STORY_GENRES.find(g => g.name === genre) || STORY_GENRES[0];

  return (
    <div>
      {/* Genre chips */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-5 w-full">
        {STORY_GENRES.map(g => {
          const isActive = genre === g.name;
          return (
            <button key={g.name} onClick={() => setGenre(g.name)}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all"
              style={{
                background: isActive ? g.color : 'rgba(255,255,255,0.05)',
                color:      isActive ? 'white'  : 'var(--text-secondary)',
                border:     isActive ? 'none'   : '1px solid var(--border)',
                transform:  isActive ? 'scale(1.05)' : 'scale(1)',
                boxShadow:  isActive ? `0 4px 15px ${g.color}50` : 'none',
              }}>
              <span>{g.emoji}</span>{g.name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{activeGenre.emoji}</span>
        <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: activeGenre.color }}>
          {genre === 'All' ? 'All Stories' : `${genre} Stories`}
        </h3>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg,${activeGenre.color}60,transparent)` }} />
      </div>

      {loading ? (
        <FeedSkeleton count={3} />
      ) : stories.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📖</div>
          <p className="font-shayari gradient-text">No stories yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Be the first to publish one!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {stories.map(s => (
              <Link key={s._id} to={`/story/${s._id}`}
                className="rounded-xl overflow-hidden glass-hover"
                style={{ border: '1px solid var(--border)' }}>
                <div className="aspect-[2/3]" style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
                  {s.coverImage ? (
                    <img src={s.coverImage} alt={s.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <p className="text-xs font-shayari text-center line-clamp-5" style={{ color: 'var(--text-secondary)' }}>
                        {s.title}
                      </p>
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>by {s.author?.username}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>❤️ {s.totalLikes || 0}</span>
                    <span>👁️ {s.totalReads || 0}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div ref={bottomRef} className="h-4" />
          {loadingMore && <div className="flex justify-center py-4"><LoadingSpinner /></div>}
          {!hasMore && stories.length > 0 && (
            <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              ✦ You've seen all stories
            </div>
          )}
        </>
      )}
    </div>
  );
}