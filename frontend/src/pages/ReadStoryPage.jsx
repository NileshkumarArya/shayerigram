import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { chapterAPI, storyAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const FONT_SIZES = [14, 16, 18, 20, 22];

export default function ReadStoryPage() {
  const { chapterId } = useParams();
  const navigate = useNavigate();

  const [chapter, setChapter] = useState(null);
  const [nextChapter, setNextChapter] = useState(null);
  const [prevChapter, setPrevChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [fontSizeIdx, setFontSizeIdx] = useState(2);
  const [showSettings, setShowSettings] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  const contentRef = useRef(null);
  const progressSaveTimeout = useRef(null);

  useEffect(() => {
    const fetchChapter = async () => {
      setLoading(true);
      try {
        const { data } = await chapterAPI.getChapter(chapterId);
        setChapter(data.chapter);
        setNextChapter(data.nextChapter);
        setPrevChapter(data.prevChapter);
        setLiked(data.isLiked || false);
        setLikeCount(data.chapter?.totalLikes || 0);
        window.scrollTo(0, 0);
      } catch (err) {
        console.error('Chapter fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChapter();
  }, [chapterId]);

  // ─── Reading progress save (scroll based) ─────────────────────────────────
  const saveProgress = useCallback((scrollPercent, completed = false) => {
    if (!chapter) return;
    clearTimeout(progressSaveTimeout.current);
    progressSaveTimeout.current = setTimeout(() => {
      storyAPI.saveProgress(chapter.story._id, {
        chapterId: chapter._id,
        chapterNumber: chapter.chapterNumber,
        scrollPosition: scrollPercent,
        isCompleted: completed,
      }).catch(() => {});
    }, 1000);
  }, [chapter]);

  const handleLike = async () => {
    if (likeLoading || !chapter) return;
    setLikeLoading(true);
    try {
      const { data } = await chapterAPI.toggleLike(chapter._id);
      setLiked(data.liked);
      setLikeCount(data.totalLikes);
    } catch (err) {
      console.error('Chapter like error:', err);
    } finally {
      setLikeLoading(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0;
      saveProgress(percent, percent >= 95);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [saveProgress]);

  if (loading) return <LoadingSpinner />;
  if (!chapter) return <div className="text-center py-16">Chapter not found.</div>;

  const bgColor = darkMode ? '#0e0e1a' : '#fdf6e3';
  const textColor = darkMode ? '#e5e5e5' : '#2d2d2d';
  const mutedColor = darkMode ? '#9ca3af' : '#6b6b6b';

  return (
    <div className="min-h-screen -mx-4 md:-mx-6 -my-4 md:-my-6" style={{ background: bgColor }}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between backdrop-blur-md"
        style={{ background: darkMode ? 'rgba(14,14,26,0.85)' : 'rgba(253,246,227,0.85)', borderBottom: `1px solid ${darkMode ? '#2a2a3a' : '#e0d8c0'}` }}>
        <Link to={`/story/${chapter.story._id}`} className="text-sm flex items-center gap-1" style={{ color: mutedColor }}>
          ← Back
        </Link>
        <p className="text-xs truncate max-w-[40%]" style={{ color: mutedColor }}>{chapter.story.title}</p>
        <button onClick={() => setShowSettings(p => !p)} className="text-lg" style={{ color: mutedColor }}>
          Aa
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="sticky top-12 z-20 mx-4 my-2 p-4 rounded-xl flex items-center justify-between"
          style={{ background: darkMode ? '#1a1a2a' : '#fff', border: `1px solid ${darkMode ? '#2a2a3a' : '#e0d8c0'}` }}>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: mutedColor }}>Font:</span>
            <button onClick={() => setFontSizeIdx(p => Math.max(0, p - 1))}
              className="w-7 h-7 rounded-lg text-sm" style={{ background: darkMode ? '#2a2a3a' : '#f0e8d0', color: textColor }}>A-</button>
            <button onClick={() => setFontSizeIdx(p => Math.min(FONT_SIZES.length - 1, p + 1))}
              className="w-7 h-7 rounded-lg text-sm" style={{ background: darkMode ? '#2a2a3a' : '#f0e8d0', color: textColor }}>A+</button>
          </div>
          <button onClick={() => setDarkMode(p => !p)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: darkMode ? '#2a2a3a' : '#f0e8d0', color: textColor }}>
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      )}

      {/* Chapter content */}
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="text-center mb-8">
          <p className="text-xs mb-2" style={{ color: mutedColor }}>Chapter {chapter.chapterNumber}</p>
          <h1 className="text-2xl font-bold mb-2" style={{ color: textColor }}>{chapter.title}</h1>
          <p className="text-xs" style={{ color: mutedColor }}>
            by {chapter.author?.username} · {chapter.readingTime} min read
          </p>
        </div>

        {/* Audio player */}
        {chapter.audioUrl && (
          <div className="mb-8 p-4 rounded-xl" style={{ background: darkMode ? '#1a1a2a' : '#fff', border: `1px solid ${darkMode ? '#2a2a3a' : '#e0d8c0'}` }}>
            <audio controls src={chapter.audioUrl} className="w-full" />
          </div>
        )}

        {/* Text content */}
        {chapter.content && (
          <div
            ref={contentRef}
            className="font-shayari leading-loose whitespace-pre-wrap"
            style={{ color: textColor, fontSize: `${FONT_SIZES[fontSizeIdx]}px`, lineHeight: 1.9 }}
          >
            {chapter.content}
          </div>
        )}

        {/* Chapter actions (like) + Navigation — grouped together below the
            divider so the like button reads as a control, not story text */}
        <div className="mt-12 pt-6" style={{ borderTop: `1px solid ${darkMode ? '#2a2a3a' : '#e0d8c0'}` }}>
          <div className="flex items-center justify-center gap-2 mb-6">
            <button onClick={handleLike} disabled={likeLoading}
              className="flex items-center gap-2 transition-all hover:scale-110 disabled:opacity-60">
              <span className="text-2xl">{liked ? '❤️' : '🤍'}</span>
              <span className="text-sm font-semibold" style={{ color: liked ? '#f87171' : textColor }}>
                {likeCount} {likeCount === 1 ? 'like' : 'likes'} on this chapter
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between">
            {prevChapter ? (
              <button onClick={() => navigate(`/read/${prevChapter._id}`)} className="text-sm px-4 py-2.5 rounded-xl"
                style={{ background: darkMode ? '#1a1a2a' : '#fff', color: textColor, border: `1px solid ${darkMode ? '#2a2a3a' : '#e0d8c0'}` }}>
                ← Previous
              </button>
            ) : <div />}

            {nextChapter ? (
              <button onClick={() => navigate(`/read/${nextChapter._id}`)}
                className="text-sm px-4 py-2.5 rounded-xl text-white"
                style={{ background: 'linear-gradient(135deg,#9333ea,#7c3aed)' }}>
                Next →
              </button>
            ) : (
              <Link to={`/story/${chapter.story._id}`} className="text-sm px-4 py-2.5 rounded-xl text-white"
                style={{ background: 'linear-gradient(135deg,#9333ea,#7c3aed)' }}>
                Finish ✓
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}