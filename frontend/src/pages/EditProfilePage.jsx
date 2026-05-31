import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import Avatar from '../components/common/Avatar';
import toast from 'react-hot-toast';

const MAX_AVATAR_SIZE = 4 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function EditProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef();

  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    bio: user?.bio || '',
    website: user?.website || '',
    location: user?.location || '',
  });
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatar(null);
      setError('Only JPG, PNG, or WebP avatars are allowed.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatar(null);
      setError('Avatar must be under 4MB.');
      return;
    }
    setError('');
    setAvatar(file);
    setAvatarPreview(prev => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') fd.append(k, v);
      });
      if (avatar) fd.append('avatar', avatar);
      const { data } = await userAPI.updateProfile(fd);
      updateUser(data.user);
      toast.success('Profile updated!');
      navigate(`/profile/${user.username}`);
    } catch (err) {
      const message = err.response?.data?.message || 'Profile update failed.';
      setError(message);
      toast.error(message);
    }
    setLoading(false);
  };

  const CATEGORIES = ['Love', 'Sad', 'Motivational', 'Funny', 'Spiritual', 'Nature', 'Life', 'Friendship'];

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center glass hover:border-purple-500/40 transition-all"
          style={{ color: 'var(--text-muted)' }}>←</button>
        <h1 className="text-xl font-cinzel gradient-text">Edit Profile</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Avatar */}
        <div className="glass rounded-2xl p-6 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden" style={{ border: '3px solid rgba(147,51,234,0.4)' }}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-semibold"
                  style={{ background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }}>
                  {user?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <button type="button" onClick={() => fileRef.current.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white', boxShadow: '0 2px 8px rgba(147,51,234,0.5)' }}>
              📷
            </button>
          </div>
          <button type="button" onClick={() => fileRef.current.click()}
            className="text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--purple-light)' }}>
            Change Photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
        </div>

        {/* Form fields */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Full Name</label>
            <input name="fullName" value={form.fullName} onChange={handleChange}
              placeholder="Your name" className="input-field" maxLength={50} />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Username
            </label>
            <div className="input-field flex items-center gap-2 cursor-not-allowed opacity-60">
              <span style={{ color: 'var(--text-muted)' }}>@</span>
              <span>{user?.username}</span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Username cannot be changed</p>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Bio <span className="ml-1 font-normal">{form.bio.length}/300</span>
            </label>
            <textarea name="bio" value={form.bio} onChange={handleChange}
              placeholder="Tell the world about your shayari journey..."
              className="input-field resize-none" rows={3} maxLength={300} />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Website</label>
            <input name="website" value={form.website} onChange={handleChange}
              placeholder="https://yourwebsite.com" className="input-field" />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Location</label>
            <input name="location" value={form.location} onChange={handleChange}
              placeholder="City, Country" className="input-field" maxLength={50} />
          </div>
        </div>

        {/* Favorite categories */}
        <div className="glass rounded-2xl p-6">
          <label className="text-xs font-medium block mb-3" style={{ color: 'var(--text-muted)' }}>Favorite Categories</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat} type="button"
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                style={{ background: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.2)', color: 'var(--purple-light)' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl text-sm text-center"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost flex-1 py-3">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/20 inline-block"
                  style={{ borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
                Saving...
              </span>
            ) : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}