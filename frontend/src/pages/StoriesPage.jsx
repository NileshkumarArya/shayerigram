import { useState, useEffect } from 'react';
import { optimizeImageUrl } from '../utils/image';
import { Link } from 'react-router-dom';
import { storyAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const GENRES = ['All', 'Love', 'Sad', 'Horror', 'Motivation', 'Comedy', 'Thriller', 'Fantasy', 'Poetry', 'Spiritual', 'Biography', 'Other'];

function StoryCard({ story }) {
  return (
    <Link to={`/story/${story._id}`} className="card overflow-hidden hover:opacity-90 transition-opacity animate-fade-in">
      <div className="aspect-[2/3] w-full overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
        {story.coverImage ? (
          <img src={optimizeImageUrl(story.coverImage, { width: 400 })} alt={story.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4">
            <p className="text-sm font-shayari text-center line-clamp-4" style={{ color: 'var(--text-secondary)' }}>
              {story.title}
            </p>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold truncate mb-1" style={{ color: 'var(--text-primary)' }}>
          {story.title}
        </h3>
        <p className="text-xs truncate mb-2" style={{ color: 'var(--text-muted)' }}>
          by {story.author?.username}
        </p>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>📖 {story.totalChapters || 0}</span>
          <span>👁️ {story.totalReads || 0}</span>
          <span>❤️ {story.totalLikes || 0}</span>
        </div>
      </div>
    </Link>
  );
}

export default function StoriesPage() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genre, setGenre] = useState('All');
  const [sort, setSort] = useState('latest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchStories = async () => {
      setLoading(true);
      try {
        const params = { page, limit: 20, sort };
        if (genre !== 'All') params.genre = genre;
        const { data } = await storyAPI.getStories(params);
        setStories(data.stories);
        setHasMore(data.hasMore);
      } catch (err) {
        console.error('Stories fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, [genre, sort, page]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold gradient-text">📚 Stories</h1>
        <Link to="/story/create" className="btn-primary text-sm py-2.5 px-5">
          + Write a Story
        </Link>
      </div>

      {/* Quick links */}
      <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-1">
        <Link to="/my-stories" className="shrink-0 px-4 py-2 rounded-xl text-xs font-medium glass-hover"
          style={{ color: 'var(--text-secondary)' }}>
          ✏️ My Stories
        </Link>
        <Link to="/story-bookmarks" className="shrink-0 px-4 py-2 rounded-xl text-xs font-medium glass-hover"
          style={{ color: 'var(--text-secondary)' }}>
          🔖 Saved
        </Link>
        <Link to="/reading-history" className="shrink-0 px-4 py-2 rounded-xl text-xs font-medium glass-hover"
          style={{ color: 'var(--text-secondary)' }}>
          📖 History
        </Link>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-4 w-fit glass">
        {[['latest', 'Latest'], ['trending', 'Trending'], ['popular', 'Popular']].map(([v, label]) => (
          <button key={v} onClick={() => setSort(v)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={sort === v ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
              : { color: 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Genre filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-6 pb-1">
        {GENRES.map(g => (
          <button key={g} onClick={() => setGenre(g)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={genre === g
              ? { background: 'rgba(147,51,234,0.2)', border: '1px solid rgba(147,51,234,0.4)', color: 'var(--purple-light)' }
              : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {g}
          </button>
        ))}
      </div>

      {/* Stories grid */}
      {loading ? (
        <LoadingSpinner />
      ) : stories.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">📖</div>
          <h3 className="text-lg font-shayari mb-2" style={{ color: 'var(--text-secondary)' }}>
            No stories yet
          </h3>
          <Link to="/story/create" className="btn-primary inline-block text-sm py-2.5 px-6 mt-2">
            Write the first story
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {stories.map(story => <StoryCard key={story._id} story={story} />)}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <button onClick={() => setPage(p => p + 1)} className="btn-ghost text-sm py-2.5 px-6">
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}