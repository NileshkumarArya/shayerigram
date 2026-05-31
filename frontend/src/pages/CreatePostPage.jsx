import CategorySelect from '../components/common/CategorySelect';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postAPI } from '../services/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['Love', 'Sad', 'Motivational', 'Funny', 'Spiritual', 'Nature', 'Life', 'Friendship', 'Patriotic', 'Other'];
const LANGUAGES = ['Hindi', 'Urdu', 'English', 'Mixed'];
const TEMPLATES = [
  { id: 'classic', label: 'Classic', bg: '#0e0e1a', color: '#f1f0ff' },
  { id: 'purple',  label: 'Purple',  bg: 'linear-gradient(135deg,#1a0533,#2d1058)', color: '#e9d5ff' },
  { id: 'rose',    label: 'Rose',    bg: 'linear-gradient(135deg,#1a0a0a,#3b0f0f)', color: '#fecaca' },
  { id: 'ocean',   label: 'Ocean',   bg: 'linear-gradient(135deg,#0a1628,#0f2d4a)', color: '#bae6fd' },
  { id: 'night',   label: 'Night',   bg: 'linear-gradient(135deg,#0d0d1a,#1a1a35)', color: '#c4b5fd' },
];

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function CreatePostPage() {
  const navigate = useNavigate();
  const [type, setType] = useState('text');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [categories, setCategories] = useState(['Love']);
  const [language, setLanguage] = useState('Hindi');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImage(null);
      setImagePreview(null);
      setError('Only JPG, PNG, or WebP images are allowed.');
      toast.error('Only JPG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImage(null);
      setImagePreview(null);
      setError('Image size must be under 8MB.');
      toast.error('Image size must be under 8MB.');
      return;
    }
    setError('');
    setImage(file);
    setImagePreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleSubmit = async () => {
    if (loading) return;
    const text = content.trim();
    if (type === 'text' && !text) {
      setError('Please write your shayari');
      toast.error('Please write your shayari');
      return;
    }
    if (type === 'image' && !image && !text) {
      setError('Please add an image or write your shayari');
      toast.error('Please add an image or write your shayari');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      if (text) fd.append('content', text);
      fd.append('title', title.trim());
      categories.forEach(c => fd.append('categories[]', c));
      fd.append('language', language);
      fd.append('type', type);
      fd.append('theme', template.id);
      fd.append('fontStyle', 'shayari');
      if (type === 'image' && image) fd.append('image', image);
      await postAPI.createPost(fd);
      toast.success('Shayari shared!');
      navigate('/');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to post';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center glass hover:border-purple-500/40 transition-all"
            style={{ color: 'var(--text-muted)' }}>←</button>
          <h1 className="text-xl font-cinzel gradient-text">New Shayari</h1>
        </div>
        <button onClick={handleSubmit}
          disabled={loading || (type === 'text' && !content.trim()) || (type === 'image' && !image && !content.trim())}
          className="btn-primary py-2 px-5 text-sm">
          {loading ? '...' : 'Share ✦'}
        </button>
      </div>

      {/* Type toggle */}
      <div className="glass rounded-xl p-1 flex mb-5">
        {[['text','📝 Text'], ['image','🖼️ Image']].map(([val, label]) => (
          <button key={val} onClick={() => setType(val)}
            className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all"
            style={type === val ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' } : { color: 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Image upload */}
      {type === 'image' && (
        <div className="mb-5">
          <label className="block w-full aspect-video rounded-2xl overflow-hidden cursor-pointer transition-all hover:opacity-90"
            style={{ border: '2px dashed var(--border)', background: 'rgba(147,51,234,0.04)' }}>
            {imagePreview ? (
              <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <div className="text-4xl">🖼️</div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Click to upload background image</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>JPG, PNG, WebP up to 8MB</p>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </label>
        </div>
      )}

      {/* Template picker (text only) */}
      {type === 'text' && (
        <div className="mb-4">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Theme</p>
          <div className="flex gap-2">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => setTemplate(t)}
                className="flex-1 h-10 rounded-xl text-xs font-medium transition-all hover:scale-105"
                style={{ background: t.bg, color: t.color, border: template.id === t.id ? '2px solid #9333ea' : '1px solid var(--border)', fontSize: '10px' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content editor */}
      <div className="mb-5 rounded-2xl overflow-hidden" style={{ background: type === 'text' ? template.bg : 'rgba(147,51,234,0.06)', border: '1px solid var(--border)' }}>
        <div className="text-3xl text-center pt-4 opacity-20 font-shayari">"</div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={`तेरे बिना जिंदगी से कोई\nशिकवा तो नहीं...\n\nWrite your shayari here...`}
          rows={7}
          maxLength={2000}
          className="w-full bg-transparent outline-none px-6 py-2 text-center resize-none"
          style={{ fontFamily: "'Playfair Display', serif", lineHeight: '2', fontSize: '1.05rem', color: type === 'text' ? template.color : 'var(--text-primary)' }}
        />
        <div className="text-right pr-4 pb-1 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{content.length}/2000</div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
          placeholder="Title (optional)..."
          className="input-field text-sm" />
      </div>

      {/* Category — Multi-select */}
      <div className="mb-4">
        <CategorySelect selected={categories} onChange={setCategories} maxSelect={3} />
      </div>

      {/* Language */}
      <div className="mb-6">
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Language</p>
        <div className="flex gap-2">
          {LANGUAGES.map(lang => (
            <button key={lang} onClick={() => setLanguage(lang)}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
              style={language === lang ? { background: 'rgba(147,51,234,0.2)', border: '1px solid #9333ea', color: 'var(--purple-light)' } : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm text-center"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button onClick={handleSubmit}
        disabled={loading || (type === 'text' && !content.trim()) || (type === 'image' && !image && !content.trim())}
        className="btn-primary w-full py-4 text-base">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 rounded-full border-2 border-white/20 inline-block"
              style={{ borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
            Sharing your shayari...
          </span>
        ) : '✦ Share Shayari'}
      </button>
    </div>
  );
}