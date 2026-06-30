import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { storyAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function ReadingHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await storyAPI.getReadingHistory();
        setHistory(data.history);
      } catch (err) {
        console.error('History fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const formatTime = (date) => {
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold gradient-text mb-6">📖 Reading History</h1>

      {loading ? (
        <LoadingSpinner />
      ) : history.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">📖</div>
          <h3 className="text-lg font-shayari mb-2" style={{ color: 'var(--text-secondary)' }}>
            Koi reading history nahi hai
          </h3>
          <Link to="/stories" className="btn-primary inline-block text-sm py-2.5 px-6 mt-2">
            Stories padhna shuru karo
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(item => (
            <Link key={item._id} to={`/read/${item.lastChapter?._id}`}
              className="card p-4 flex items-center gap-4 hover:opacity-90 transition-opacity">
              <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0"
                style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
                {item.story?.coverImage ? (
                  <img src={item.story.coverImage} alt={item.story.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-1">
                    <p className="text-[7px] font-shayari text-center line-clamp-4" style={{ color: 'var(--text-secondary)' }}>
                      {item.story?.title}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {item.story?.title}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Ch. {item.lastChapterNumber} · {item.lastChapter?.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{
                      width: `${item.scrollPosition}%`,
                      background: 'linear-gradient(90deg,#9333ea,#7c3aed)',
                    }} />
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {item.scrollPosition}%
                  </span>
                </div>
              </div>

              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                {formatTime(item.lastReadAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}