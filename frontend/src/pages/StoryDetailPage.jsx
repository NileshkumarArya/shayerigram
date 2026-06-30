import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storyAPI, chapterAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function StoryDetailPage() {
  const { storyId } = useParams();
  const { user } = useAuth();

  const [story, setStory] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [progress, setProgress] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [storyRes, chaptersRes] = await Promise.all([
          storyAPI.getStory(storyId),
          chapterAPI.getChapters(storyId),
        ]);
        setStory(storyRes.data.story);
        setProgress(storyRes.data.progress);
        setIsBookmarked(storyRes.data.isBookmarked);
        setChapters(chaptersRes.data.chapters);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [storyId]);

  const handleBookmark = async () => {
    setBookmarkLoading(true);
    try {
      const { data } = await storyAPI.toggleBookmark(storyId);
      setIsBookmarked(data.isBookmarked);
    } catch (err) {
      console.error('Bookmark error:', err);
    } finally {
      setBookmarkLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!story) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">📖</div>
        <h3 className="text-lg font-semibold mb-2">Story nahi mili</h3>
      </div>
    );
  }

  const isAuthor = user?._id === story.author?._id;
  const publishedChapters = chapters.filter(c => c.status === 'published');
  const startChapter = progress?.lastChapter || publishedChapters[0];

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Story header */}
      <div className="flex gap-5 mb-6">
        <div className="w-32 aspect-[2/3] rounded-xl overflow-hidden shrink-0"
          style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
          {story.coverImage ? (
            <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-2">
              <p className="text-xs font-shayari text-center line-clamp-5" style={{ color: 'var(--text-secondary)' }}>
                {story.title}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{story.title}</h1>
          <Link to={`/profile/${story.author?.username}`} className="text-sm hover:underline" style={{ color: 'var(--purple-light)' }}>
            by {story.author?.username}
          </Link>

          <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>📖 {story.totalChapters} chapters</span>
            <span>👁️ {story.totalReads} reads</span>
            <span>🔖 {story.totalBookmarks}</span>
          </div>

          <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: 'rgba(147,51,234,0.15)', color: 'var(--purple-light)' }}>
            {story.genre}
          </span>

          {story.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {story.tags.map(t => (
                <span key={t} className="text-xs" style={{ color: 'var(--text-muted)' }}>#{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {story.description && (
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
          {story.description}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mb-6">
        {publishedChapters.length > 0 ? (
          <Link to={`/read/${startChapter._id || startChapter.lastChapter}`} className="btn-primary flex-1 text-center py-3 text-sm">
            {progress ? `▶ Continue Ch. ${progress.lastChapterNumber}` : '▶ Start Reading'}
          </Link>
        ) : (
          <div className="flex-1 text-center py-3 text-sm rounded-xl" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            Koi chapter published nahi hai
          </div>
        )}

        {!isAuthor && (
          <button onClick={handleBookmark} disabled={bookmarkLoading}
            className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
            style={isBookmarked
              ? { background: 'rgba(147,51,234,0.2)', color: 'var(--purple-light)', border: '1px solid rgba(147,51,234,0.4)' }
              : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {isBookmarked ? '🔖 Saved' : '🔖 Save'}
          </button>
        )}

        {isAuthor && (
          <Link to={`/story/${storyId}/edit`} className="btn-ghost px-5 py-3 text-sm">
            ✏️ Edit
          </Link>
        )}
      </div>

      {/* Chapters list */}
      <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        Chapters ({publishedChapters.length})
      </h2>

      <div className="space-y-2">
        {publishedChapters.map(ch => {
          const isRead = progress?.lastChapterNumber > ch.chapterNumber;
          const isCurrent = progress?.lastChapterNumber === ch.chapterNumber;
          return (
            <Link key={ch._id} to={`/read/${ch._id}`}
              className="card p-4 flex items-center justify-between hover:opacity-90 transition-opacity">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs w-8 shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {ch.chapterNumber}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {ch.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {ch.readingTime} min read
                  </p>
                </div>
              </div>
              {isCurrent && <span className="text-xs shrink-0" style={{ color: 'var(--purple-light)' }}>● Reading</span>}
              {isRead && !isCurrent && <span className="text-xs shrink-0" style={{ color: '#4ade80' }}>✓</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}