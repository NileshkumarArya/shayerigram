import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storyAPI } from '../services/api';

const GENRES = ['Love', 'Sad', 'Horror', 'Motivation', 'Comedy', 'Thriller', 'Fantasy', 'Poetry', 'Spiritual', 'Biography', 'Other'];
const LANGUAGES = [['hindi', 'हिंदी'], ['urdu', 'اردو'], ['english', 'English'], ['hinglish', 'Hinglish']];

export default function CreateStoryPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('Love');
  const [language, setLanguage] = useState('hindi');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t) || tags.length >= 10) return;
    setTags([...tags, t]);
    setTagInput('');
  };

  const removeTag = (t) => setTags(tags.filter(x => x !== t));

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title likhna zaroori hai.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('genre', genre);
      formData.append('language', language);
      formData.append('tags', JSON.stringify(tags));
      if (coverFile) formData.append('cover', coverFile);

      const { data } = await storyAPI.createStory(formData);
      navigate(`/story/${data.story._id}/edit`);
    } catch (err) {
      setError(err.response?.data?.message || 'Story create nahi hui. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold gradient-text mb-6">📚 Start a New Story</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {error && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* Cover image */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Cover Image
          </label>
          <label className="block w-32 aspect-[2/3] rounded-xl cursor-pointer overflow-hidden border-2 border-dashed"
            style={{ borderColor: 'var(--border)' }}>
            {coverPreview ? (
              <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl" style={{ color: 'var(--text-muted)' }}>
                📷
              </div>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverChange} className="hidden" />
          </label>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Story ka naam likho..."
            maxLength={200}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Story kis baare mein hai..."
            maxLength={1000}
            rows={4}
            className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>{description.length}/1000</p>
        </div>

        {/* Genre */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Genre
          </label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <button key={g} type="button" onClick={() => setGenre(g)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={genre === g
                  ? { background: 'rgba(147,51,234,0.2)', border: '1px solid rgba(147,51,234,0.4)', color: 'var(--purple-light)' }
                  : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Language
          </label>
          <div className="flex gap-2">
            {LANGUAGES.map(([v, label]) => (
              <button key={v} type="button" onClick={() => setLanguage(v)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={language === v
                  ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
                  : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Tags (max 10)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Tag likh ke Enter dabao..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <button type="button" onClick={addTag} className="btn-ghost text-sm px-4">Add</button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                  style={{ background: 'rgba(147,51,234,0.15)', color: 'var(--purple-light)' }}>
                  #{t}
                  <button type="button" onClick={() => removeTag(t)} className="hover:text-red-400">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50">
          {loading ? 'Creating...' : 'Create Story → Add Chapters'}
        </button>
      </form>
    </div>
  );
}