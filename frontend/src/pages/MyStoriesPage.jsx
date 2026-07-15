import { useState, useEffect } from 'react';
import { optimizeImageUrl } from '../utils/image';
import { Link } from 'react-router-dom';
import { storyAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function MyStoriesPage() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchStories = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      const { data } = await storyAPI.getMyStories(params);
      setStories(data.stories);
    } catch (err) {
      console.error('My stories fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStories(); }, [filter]);

  const handleDelete = async (storyId) => {
    if (!window.confirm('Delete this story? This cannot be undone.')) return;
    try {
      await storyAPI.deleteStory(storyId);
      setStories(prev => prev.filter(s => s._id !== storyId));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold gradient-text">📚 My Stories</h1>
        <Link to="/story/create" className="btn-primary text-sm py-2.5 px-5">
          + New Story
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit glass">
        {[['all', 'All'], ['published', 'Published'], ['draft', 'Drafts']].map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={filter === v ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
              : { color: 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : stories.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">📖</div>
          <h3 className="text-lg font-shayari mb-2" style={{ color: 'var(--text-secondary)' }}>
            No stories yet
          </h3>
          <Link to="/story/create" className="btn-primary inline-block text-sm py-2.5 px-6 mt-2">
            Start a story
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {stories.map(story => (
            <div key={story._id} className="card p-4 flex items-center gap-4">
              <Link to={`/story/${story._id}`} className="shrink-0">
                <div className="w-16 h-24 rounded-lg overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
                  {story.coverImage ? (
                    <img src={optimizeImageUrl(story.coverImage, { width: 240 })} alt={story.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-1">
                      <p className="text-[8px] font-shayari text-center line-clamp-4" style={{ color: 'var(--text-secondary)' }}>
                        {story.title}
                      </p>
                    </div>
                  )}
                </div>
              </Link>

              <div className="flex-1 min-w-0">
                <Link to={`/story/${story._id}`}>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {story.title}
                  </p>
                </Link>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {story.genre} · {story.totalChapters} chapters
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>👁️ {story.totalReads}</span>
                  <span>🔖 {story.totalBookmarks}</span>
                  <span className="px-2 py-0.5 rounded-full font-medium"
                    style={story.status === 'published'
                      ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                      : { background: 'rgba(234,179,8,0.15)', color: '#fbbf24' }}>
                    {story.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <Link to={`/story/${story._id}/edit`} className="text-xs px-3 py-1.5 rounded-lg btn-ghost text-center">
                  Edit
                </Link>
                <button onClick={() => handleDelete(story._id)}
                  className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}