import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { clubAPI } from '../services/api';
import { FeedSkeleton } from '../components/common/Skeleton';

const THEMES = [
  { name: 'All',         emoji: '✨' },
  { name: 'Love',        emoji: '❤️' },
  { name: 'Sad',         emoji: '💧' },
  { name: 'Horror',      emoji: '👻' },
  { name: 'Motivation',  emoji: '⚡' },
  { name: 'Comedy',      emoji: '😄' },
  { name: 'Thriller',    emoji: '🔪' },
  { name: 'Fantasy',     emoji: '🐉' },
  { name: 'Poetry',      emoji: '🪶' },
  { name: 'Spiritual',   emoji: '🕊️' },
  { name: 'General',     emoji: '💬' },
];

export default function ClubsPage() {
  const [theme,     setTheme]     = useState('All');
  const [clubs,     setClubs]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showCreate,setShowCreate]= useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await clubAPI.getClubs({ theme });
      setClubs(data.clubs || []);
    } catch (err) {
      console.error('Clubs load error:', err);
    } finally {
      setLoading(false);
    }
  }, [theme]);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async (e, clubId) => {
    e.preventDefault();
    setClubs(prev => prev.map(c => c._id === clubId
      ? { ...c, isMember: !c.isMember, membersCount: c.membersCount + (c.isMember ? -1 : 1) }
      : c));
    try {
      await clubAPI.toggleMembership(clubId);
    } catch (err) {
      // revert
      setClubs(prev => prev.map(c => c._id === clubId
        ? { ...c, isMember: !c.isMember, membersCount: c.membersCount + (c.isMember ? -1 : 1) }
        : c));
      if (err.response?.data?.message) alert(err.response.data.message);
    }
  };

  return (
    <div className="animate-fade-in w-full min-w-0">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-cinzel gradient-text mb-1">🤝 Clubs</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Connect with writers who share your interests</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm px-4 py-2.5">
          + Create Club
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-5 w-full">
        {THEMES.map(t => (
          <button key={t.name} onClick={() => setTheme(t.name)}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all"
            style={theme === t.name
              ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
              : { background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            {t.emoji} {t.name}
          </button>
        ))}
      </div>

      {loading ? (
        <FeedSkeleton count={3} />
      ) : clubs.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🤝</div>
          <p className="font-shayari gradient-text">No clubs found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Be the first to create one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {clubs.map(c => (
            <Link key={c._id} to={`/clubs/${c._id}`}
              className="rounded-2xl overflow-hidden glass-hover flex flex-col"
              style={{ border: '1px solid var(--border)' }}>
              <div className="h-24 flex items-center justify-center text-3xl"
                style={{ background: c.coverImage ? undefined : 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
                {c.coverImage
                  ? <img src={c.coverImage} alt={c.name} className="w-full h-full object-cover" />
                  : c.emoji}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{c.emoji} {c.name}</p>
                <p className="text-xs mt-1 line-clamp-2 flex-1" style={{ color: 'var(--text-muted)' }}>
                  {c.description || 'No description'}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    👥 {c.membersCount} members
                  </span>
                  <button onClick={(e) => handleJoin(e, c._id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={c.isMember
                      ? { background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                      : { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }}>
                    {c.isMember ? 'Joined' : 'Join'}
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && <CreateClubModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateClubModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('General');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Club name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('description', description.trim());
      fd.append('theme', theme);
      if (coverFile) fd.append('cover', coverFile);
      await clubAPI.createClub(fd);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create club.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <form onSubmit={handleSubmit}
        className="glass rounded-2xl p-6 max-w-md w-full space-y-4 animate-fade-in"
        style={{ border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}>
       <h2 className="text-lg font-bold gradient-text">🤝 Create a New Club</h2>

        {error && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <label className="block w-full h-24 rounded-xl cursor-pointer overflow-hidden border-2 border-dashed flex items-center justify-center"
          style={{ borderColor: 'var(--border)' }}>
          {coverPreview
            ? <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
            : <span className="text-2xl" style={{ color: 'var(--text-muted)' }}>📷 Cover (optional)</span>}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverChange} className="hidden" />
        </label>

        <input value={name} onChange={e => setName(e.target.value)} placeholder="Club name..."
          maxLength={60}
          className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />

        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this club about..."
          maxLength={300} rows={3}
          className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />

        <div className="flex flex-wrap gap-2">
          {THEMES.filter(t => t.name !== 'All').map(t => (
            <button key={t.name} type="button" onClick={() => setTheme(t.name)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={theme === t.name
                ? { background: 'rgba(147,51,234,0.2)', border: '1px solid rgba(147,51,234,0.4)', color: 'var(--purple-light)' }
                : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {t.emoji} {t.name}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}