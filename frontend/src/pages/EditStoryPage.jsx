import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { storyAPI, chapterAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function EditStoryPage() {
  const { storyId } = useParams();
  const navigate = useNavigate();

  const [story, setStory] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddChapter, setShowAddChapter] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [chapterCoverFile, setChapterCoverFile] = useState(null);
  const [chapterCoverPreview, setChapterCoverPreview] = useState(null);
  const [contentType, setContentType] = useState('text');
  const [isMature, setIsMature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editingChapterId, setEditingChapterId] = useState(null);

  const fetchData = async () => {
    try {
      const [storyRes, chaptersRes] = await Promise.all([
        storyAPI.getStory(storyId),
        chapterAPI.getChapters(storyId),
      ]);
      setStory(storyRes.data.story);
      setChapters(chaptersRes.data.chapters);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [storyId]);

  const resetChapterForm = () => {
    setChapterCoverFile(null);
    setChapterCoverPreview(null);
    setChapterTitle('');
    setChapterContent('');
    setAudioFile(null);
    setContentType('text');
    setIsMature(false);
    setShowAddChapter(false);
    setEditingChapterId(null);
  };

  const handleEditChapter = async (chapterId) => {
    try {
      const { data } = await chapterAPI.getChapter(chapterId);
      setEditingChapterId(chapterId);
      setChapterTitle(data.chapter.title);
      setChapterContent(data.chapter.content);
      setContentType(data.chapter.contentType);
      setIsMature(!!data.chapter.isMature);
      setShowAddChapter(true);
    } catch (err) {
      console.error('Chapter fetch error:', err);
    }
  };

  const handleSaveChapter = async (publish = false) => {
    if (!chapterTitle.trim()) {
      setError('Chapter title is required.');
      return;
    }
    if (contentType !== 'audio' && !chapterContent.trim()) {
      setError('Chapter content is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('title', chapterTitle.trim());
      formData.append('content', chapterContent);
      formData.append('contentType', contentType);
      formData.append('isMature', isMature);
      if (publish) formData.append('status', 'published');
      if (audioFile) formData.append('audio', audioFile);
      if (chapterCoverFile) formData.append('cover', chapterCoverFile);

      if (editingChapterId) {
        await chapterAPI.updateChapter(editingChapterId, formData);
      } else {
        await chapterAPI.addChapter(storyId, formData);
      }

      resetChapterForm();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save chapter.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChapter = async (chapterId) => {
    if (!window.confirm('Ye chapter delete karna hai?')) return;
    try {
      await chapterAPI.deleteChapter(chapterId);
      fetchData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handlePublishStory = async () => {
    try {
      await storyAPI.updateStory(storyId, (() => {
        const fd = new FormData();
        fd.append('status', 'published');
        return fd;
      })());
      fetchData();
    } catch (err) {
      console.error('Publish error:', err);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!story) return <div className="text-center py-16">Story not found.</div>;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Story header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          {story.coverImage && (
            <img src={story.coverImage} alt={story.title} className="w-20 h-30 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{story.title}</h1>
            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{story.genre} · {story.totalChapters} chapters</p>
            <span className="text-xs px-2 py-1 rounded-full font-semibold"
              style={story.status === 'published'
                ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                : { background: 'rgba(234,179,8,0.15)', color: '#fbbf24' }}>
              {story.status === 'published' ? '✓ Published' : '📝 Draft'}
            </span>
          </div>
        </div>

        {story.status === 'draft' && story.totalChapters > 0 && (
          <button onClick={handlePublishStory} className="btn-primary w-full mt-4 py-2.5 text-sm">
            🚀 Publish Story
          </button>
        )}
        {story.status === 'draft' && story.totalChapters === 0 && (
          <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
            Add at least 1 chapter to publish
          </p>
        )}
      </div>

      {/* Chapters list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Chapters</h2>
        {!showAddChapter && (
          <button onClick={() => setShowAddChapter(true)} className="btn-primary text-sm py-2 px-4">
            + Add Chapter
          </button>
        )}
      </div>

      {chapters.length === 0 && !showAddChapter && (
        <div className="text-center py-10 card mb-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No chapters yet</p>
        </div>
      )}

      <div className="space-y-2 mb-6">
        {chapters.map(ch => (
          <div key={ch._id} className="card p-4 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Ch {ch.chapterNumber}: {ch.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {ch.status === 'published' ? '✓ Published' : '📝 Draft'} · {ch.readingTime} min read
                {ch.isMature && <span className="ml-1.5 text-red-400 font-semibold">🔞 Mature</span>}
              </p>
            </div>
            <div className="flex gap-2 shrink-0 ml-3">
              <button onClick={() => handleEditChapter(ch._id)} className="text-xs px-3 py-1.5 rounded-lg btn-ghost">
                Edit
              </button>
              <button onClick={() => handleDeleteChapter(ch._id)} className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit chapter form */}
      {showAddChapter && (
        <div className="card p-6 space-y-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editingChapterId ? 'Edit Chapter' : 'New Chapter'}
          </h3>

          {error && (
            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Content type toggle */}
          <div className="flex gap-2">
            {[['text', '📝 Text'], ['audio', '🎙 Audio'], ['text_audio', '📝🎙 Both']].map(([v, label]) => (
              <button key={v} type="button" onClick={() => setContentType(v)}
                className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
                style={contentType === v
                  ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
                  : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {label}
              </button>
           ))}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={isMature} onChange={(e) => setIsMature(e.target.checked)} />
            🔞 Mark this chapter as Mature (explicit/intense content)
          </label>

          <label className="block w-full h-32 rounded-xl cursor-pointer overflow-hidden border-2 border-dashed flex items-center justify-center"
            style={{ borderColor: 'var(--border)' }}>
            {chapterCoverPreview ? (
              <img src={chapterCoverPreview} alt="Chapter cover" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl" style={{ color: 'var(--text-muted)' }}>📷 Chapter Cover (optional)</span>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                setChapterCoverFile(file);
                setChapterCoverPreview(URL.createObjectURL(file));
              }} />
          </label>

          <input
            type="text"
            value={chapterTitle}
            onChange={(e) => setChapterTitle(e.target.value)}
            placeholder="Chapter title..."
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />

          {(contentType === 'text' || contentType === 'text_audio') && (
            <textarea
              value={chapterContent}
              onChange={(e) => setChapterContent(e.target.value)}
              placeholder="Write your chapter here..."
              rows={10}
              maxLength={50000}
              className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 font-shayari leading-relaxed"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
          )}

          {(contentType === 'audio' || contentType === 'text_audio') && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Audio Upload (MP3, WAV, M4A — max 30MB)
              </label>
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a"
                onChange={(e) => setAudioFile(e.target.files[0])}
                className="text-sm"
                style={{ color: 'var(--text-muted)' }}
              />
              {audioFile && <p className="text-xs mt-1" style={{ color: 'var(--purple-light)' }}>{audioFile.name}</p>}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={resetChapterForm} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
            <button onClick={() => handleSaveChapter(false)} disabled={saving} className="btn-ghost flex-1 py-2.5 text-sm disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button onClick={() => handleSaveChapter(true)} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
              {saving ? 'Saving...' : 'Publish'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}