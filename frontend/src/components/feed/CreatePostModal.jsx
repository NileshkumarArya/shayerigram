import CategorySelect from '../common/CategorySelect';
import { useState, useRef, useEffect } from 'react';
import { useDraftAutosave, loadDraft, clearDraft } from '../../hooks/useDraftAutosave';
import { postAPI } from '../../services/api';

const LANGUAGES = ['Hindi', 'Urdu', 'English', 'Mixed'];

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const THEMES = [
  { id: 'classic',  label: 'Classic',  bg: '#0e0e1a',                                        text: '#f1f0ff', accent: '#9333ea' },
  { id: 'purple',   label: 'Purple',   bg: 'linear-gradient(135deg,#3b0764,#6b21a8)',         text: '#f3e8ff', accent: '#e879f9' },
  { id: 'rose',     label: 'Rose',     bg: 'linear-gradient(135deg,#881337,#be123c)',         text: '#ffe4e6', accent: '#fda4af' },
  { id: 'ocean',    label: 'Ocean',    bg: 'linear-gradient(135deg,#0c4a6e,#0369a1)',         text: '#e0f2fe', accent: '#38bdf8' },
  { id: 'forest',   label: 'Forest',   bg: 'linear-gradient(135deg,#14532d,#15803d)',         text: '#dcfce7', accent: '#4ade80' },
  { id: 'golden',   label: 'Golden',   bg: 'linear-gradient(135deg,#78350f,#b45309)',         text: '#fef3c7', accent: '#fcd34d' },
  { id: 'midnight', label: 'Midnight', bg: 'linear-gradient(135deg,#020617,#1e1b4b)',         text: '#c7d2fe', accent: '#818cf8' },
  { id: 'sunset',   label: 'Sunset',   bg: 'linear-gradient(135deg,#9a3412,#c2410c)',         text: '#ffedd5', accent: '#fb923c' },
  { id: 'slate',    label: 'Slate',    bg: 'linear-gradient(135deg,#334155,#475569)',         text: '#f1f5f9', accent: '#94a3b8' },
  { id: 'cherry',   label: 'Cherry',   bg: 'linear-gradient(135deg,#9f1239,#e11d48)',         text: '#ffe4e6', accent: '#fda4af' },
  { id: 'sage',     label: 'Sage',     bg: 'linear-gradient(135deg,#166534,#4d7c0f)',         text: '#f0fdf4', accent: '#86efac' },
  { id: 'cosmic',   label: 'Cosmic',   bg: 'linear-gradient(135deg,#312e81,#4c1d95)',         text: '#ede9fe', accent: '#a78bfa' },
];

const FONTS = [
  { id: 'shayari',     label: 'Shayari',  css: "'Playfair Display',serif",      sample: 'शायरी'   },
  { id: 'urdu',        label: 'Urdu',     css: "'Noto Nastaliq Urdu',serif",     sample: 'اردو'    },
  { id: 'modern',      label: 'Modern',   css: "'Poppins',sans-serif",           sample: 'Modern'  },
  { id: 'elegant',     label: 'Elegant',  css: "'Cormorant Garamond',serif",     sample: 'ελεγαντ' },
  { id: 'bold',        label: 'Bold',     css: "'Oswald',sans-serif",            sample: 'BOLD'    },
  { id: 'handwritten', label: 'Written',  css: "'Dancing Script',cursive",       sample: 'Written' },
  { id: 'poetic',      label: 'Poetic',   css: "'Lora',serif",                   sample: 'Poetic'  },
  { id: 'minimal',     label: 'Minimal',  css: "'Inter',sans-serif",             sample: 'Minimal' },
];

export default function CreatePostModal({ onClose, onCreated, onPostCreated, clubId }) {
  const [step,       setStep]       = useState(1);
  const [type,       setType]       = useState('text');
  const [content,    setContent]    = useState(() => loadDraft()?.content || '');
  const [title,      setTitle]      = useState('');
  const [categories, setCategories] = useState(['Love']);
  const [language,   setLanguage]   = useState('Hindi');
  const [image,      setImage]      = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [theme,      setTheme]      = useState(THEMES[0]);
  const [font,       setFont]       = useState(FONTS[0]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const fileRef = useRef();

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImage(null);
      setImgPreview(null);
      setError('Only JPG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImage(null);
      setImgPreview(null);
      setError('Image size must be under 8MB.');
      return;
    }
    setError('');
    setImage(file);
    setImgPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  useEffect(() => {
    return () => {
      if (imgPreview) URL.revokeObjectURL(imgPreview);
    };
  }, [imgPreview]);

  const handleSubmit = async () => {
    if (loading) return;
    const text = content.trim();
    if (type === 'text' && !text) {
      setError('Please write your shayari');
      return;
    }
    if (type === 'image' && !image && !text) {
      setError('Please add an image or write your shayari');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      if (text) fd.append('content', text);
      fd.append('title', title.trim());
      fd.append('writtenIn', language);
      fd.append('type', type);
      fd.append('theme', theme.id);
      fd.append('fontStyle', font.id);
      categories.forEach(c => fd.append('categories[]', c));
      if (type === 'image' && image) fd.append('image', image);
      if (clubId) fd.append('clubId', clubId);
      const { data } = await postAPI.createPost(fd);
      clearDraft();
      onCreated?.(data.post);
      onPostCreated?.(data.post);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create post.');
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    if (type === 'text' && !content.trim()) {
      setError('Please write your shayari');
      return;
    }
    if (type === 'image' && !image && !content.trim()) {
      setError('Please add an image or write your shayari');
      return;
    }
    setError('');
    setStep(3);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden animate-fade-in"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          maxHeight: '96vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={() => { setStep(step - 1); setError(''); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
                style={{ color: 'var(--text-muted)' }}>←</button>
            )}
            <h2 className="font-semibold font-cinzel gradient-text text-base">
              {step === 1 ? 'New Shayari' : step === 2 ? 'Write Your Heart' : 'Finish'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[1,2,3].map(s => (
                <div key={s} className="h-1.5 rounded-full transition-all"
                  style={{ width: s <= step ? '18px' : '6px',
                    background: s <= step ? '#9333ea' : 'var(--border)' }} />
              ))}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 text-gray-400">✕</button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-5 py-4" style={{ flex: 1 }}>

          {/* STEP 1: Choose type */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>
                Choose how you want to share your shayari
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { val: 'text',  icon: '📝', title: 'Text Shayari',  desc: 'Pure words, pure emotion' },
                  { val: 'image', icon: '🖼️', title: 'Image Shayari', desc: 'Shayari on an image' },
                ].map(opt => (
                  <button key={opt.val}
                    onClick={() => { setType(opt.val); setStep(2); }}
                    className="p-6 rounded-2xl text-center transition-all hover:scale-105"
                    style={{ border: '1px solid var(--border)', background: 'rgba(147,51,234,0.04)' }}>
                    <div className="text-4xl mb-3">{opt.icon}</div>
                    <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{opt.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Text post */}
          {step === 2 && type === 'text' && (
            <div className="space-y-5 animate-fade-in">

              {/* Theme row */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}>Theme</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => setTheme(t)} title={t.label}
                      className="relative h-9 rounded-xl transition-all overflow-hidden"
                      style={{
                        background: t.bg,
                        border:     theme.id === t.id ? `2px solid ${t.accent}` : '1px solid rgba(255,255,255,0.1)',
                        boxShadow:  theme.id === t.id ? `0 0 12px ${t.accent}80` : 'none',
                        transform:  theme.id === t.id ? 'scale(1.1)' : 'scale(1)',
                      }}>
                      <span style={{ position:'absolute', inset:0, display:'flex',
                        alignItems:'center', justifyContent:'center',
                        color: t.text, fontSize: '7px', fontWeight: 700, opacity: 0.95 }}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font row */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}>Font Style</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {FONTS.map(f => (
                    <button key={f.id} onClick={() => setFont(f)}
                      className="py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-0.5"
                      style={{
                        background: font.id === f.id ? 'rgba(147,51,234,0.2)' : 'rgba(255,255,255,0.04)',
                        border:     font.id === f.id ? '1.5px solid #9333ea' : '1px solid rgba(255,255,255,0.08)',
                        transform:  font.id === f.id ? 'scale(1.04)' : 'scale(1)',
                      }}>
                      <span style={{ fontFamily: f.css, fontSize: '13px',
                        color: font.id === f.id ? '#c084fc' : 'var(--text-secondary)' }}>
                        {f.sample}
                      </span>
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)', opacity: 0.7 }}>
                        {f.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Writing canvas */}
              <div className="rounded-2xl overflow-hidden relative"
                style={{ background: theme.bg, border: `1.5px solid ${theme.accent}50` }}>
                <div className="pt-4 pb-0 text-center text-2xl select-none"
                  style={{ color: theme.accent, opacity: 0.5, lineHeight: 1 }}>"</div>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={"तेरे बिना जिंदगी से कोई...\nशिकवा तो नहीं...\n\nWrite your shayari here..."}
                  rows={7}
                  maxLength={2000}
                  className="w-full bg-transparent outline-none px-5 py-2 text-center resize-none"
                  style={{ fontFamily: font.css, lineHeight: '2',
                    fontSize: '1rem', color: theme.text, caretColor: theme.accent }}
                />
                <div className="pb-4 pt-0 text-center text-2xl select-none"
                  style={{ color: theme.accent, opacity: 0.5, lineHeight: 1 }}>"</div>
                <div className="absolute bottom-0 left-6 right-6 h-px"
                  style={{ background: `linear-gradient(90deg,transparent,${theme.accent}70,transparent)` }} />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{content.length}/2000</span>
                {error && <span className="text-xs text-red-400">{error}</span>}
              </div>

              <button onClick={goNext} className="btn-primary w-full py-3">Continue →</button>
            </div>
          )}

          {/* STEP 2: Image post */}
          {step === 2 && type === 'image' && (
            <div className="space-y-4 animate-fade-in">
              <div onClick={() => fileRef.current.click()}
                className="w-full rounded-2xl overflow-hidden cursor-pointer flex items-center justify-center"
                style={{ aspectRatio: '4/3', border: '2px dashed rgba(147,51,234,0.4)',
                  background: 'rgba(147,51,234,0.04)' }}>
                {imgPreview
                  ? <img src={imgPreview} alt="preview" className="w-full h-full object-cover" />
                  : <div className="text-center p-8">
                      <div className="text-5xl mb-3">🖼️</div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Click to upload</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>JPG, PNG, WebP - Max 8MB</p>
                    </div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="Write your shayari caption... (optional)" rows={3} maxLength={2000}
                className="input-field resize-none" />
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{content.length}/2000</span>
                {error && <span className="text-xs text-red-400">{error}</span>}
              </div>
              <button onClick={goNext} className="btn-primary w-full py-3">Continue →</button>
            </div>
          )}

          {/* STEP 3: Details */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">

              {/* Preview */}
              <div className="rounded-xl overflow-hidden"
                style={{ background: type === 'text' ? theme.bg : 'rgba(147,51,234,0.06)',
                  border: `1px solid ${type === 'text' ? theme.accent + '40' : 'rgba(147,51,234,0.15)'}` }}>
                <p className="text-xs px-3 pt-2 pb-0.5" style={{ color: 'var(--text-muted)' }}>Preview</p>
                <p className="px-4 pb-3 text-sm leading-relaxed line-clamp-3"
                  style={{ fontFamily: type === 'text' ? font.css : 'inherit',
                    color: type === 'text' ? theme.text : 'var(--text-secondary)' }}>
                  {content}
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Title <span style={{ opacity: 0.5 }}>(optional)</span>
                </label>
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
                  placeholder="Give your shayari a title..."
                  className="input-field text-sm" />
              </div>

              {/* Category */}
              <CategorySelect selected={categories} onChange={setCategories} maxSelect={3} />

              {/* Language */}
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>Language</label>
                <div className="flex gap-2 flex-wrap">
                  {LANGUAGES.map(lang => (
                    <button key={lang} onClick={() => setLanguage(lang)}
                      className="py-1.5 px-4 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: language === lang ? 'rgba(147,51,234,0.2)' : 'transparent',
                        color:      language === lang ? '#c084fc' : 'var(--text-muted)',
                        border:     `1px solid ${language === lang ? '#9333ea' : 'var(--border)'}`,
                      }}>{lang}</button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl text-sm text-center"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full py-3.5">
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/20"
                        style={{ borderTopColor:'white', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
                      Sharing...
                    </span>
                  : '✦ Share Shayari'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}