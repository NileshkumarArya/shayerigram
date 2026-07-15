import { useState, useEffect } from 'react';
import { optimizeImageUrl } from '../utils/image';
import { Link } from 'react-router-dom';
import { storyAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function BookmarksPage() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const { data } = await storyAPI.getMyBookmarks();
        setStories(data.stories);
      } catch (err) {
        console.error('Bookmarks fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookmarks();
  }, []);

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold gradient-text mb-6">🔖 Saved Stories</h1>

      {loading ? (
        <LoadingSpinner />
      ) : stories.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">🔖</div>
          <h3 className="text-lg font-shayari mb-2" style={{ color: 'var(--text-secondary)' }}>
            No saved stories yet
          </h3>
          <Link to="/stories" className="btn-primary inline-block text-sm py-2.5 px-6 mt-2">
            Explore stories
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stories.map(story => (
            <Link key={story._id} to={`/story/${story._id}`}
              className="card overflow-hidden hover:opacity-90 transition-opacity">
              <div className="aspect-[2/3] w-full overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
                {story.coverImage ? (
                  <img src={optimizeImageUrl(story.coverImage, { width: 400 })} alt={story.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-3">
                    <p className="text-xs font-shayari text-center line-clamp-4" style={{ color: 'var(--text-secondary)' }}>
                      {story.title}
                    </p>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{story.title}</p>
                <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                  by {story.author?.username}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}