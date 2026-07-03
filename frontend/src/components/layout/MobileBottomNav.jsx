import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CreatePostModal from '../feed/CreatePostModal';
import Avatar from '../common/Avatar';
import { useSocket } from '../../hooks/useSocket'; // no-op placeholder removed below if unused
export default function MobileBottomNav({ notifCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    setShowProfileMenu(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const tab = (to, icon, label) => (
    <Link to={to} className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5">
      <span className="text-xl">{icon}</span>
      <span className="text-[10px] font-medium" style={{ color: isActive(to) ? '#c084fc' : 'var(--text-muted)' }}>
        {label}
      </span>
    </Link>
  );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden glass-strong"
        style={{ borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* Home */}
        {tab('/', '🏠', 'Home')}

        {/* Explore */}
        {tab('/explore', '🔍', 'Explore')}

        {/* Create */}
        <button
          onClick={() => setShowCreateMenu(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}>
            <span className="text-white text-lg leading-none">+</span>
          </div>
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Create</span>
        </button>

        {/* Notifications */}
        <Link to="/notifications" className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative">
          <span className="text-xl">🔔</span>
          {notifCount > 0 && (
            <span className="absolute top-1.5 right-1/4 min-w-4 h-4 px-1 rounded-full text-[10px] flex items-center justify-center font-bold"
              style={{ background: '#9333ea', color: 'white' }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
          <span className="text-[10px] font-medium" style={{ color: isActive('/notifications') ? '#c084fc' : 'var(--text-muted)' }}>
            Activity
          </span>
        </Link>

        {/* Profile tab — opens bottom sheet */}
        <button
          onClick={() => setShowProfileMenu(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
        >
          <div className={isActive(`/profile/${user?.username}`) ? 'ring-2 ring-purple-500 rounded-full' : ''}>
            <Avatar user={user} size="xs" clickable={false} />
          </div>
          <span className="text-[10px] font-medium" style={{ color: isActive(`/profile/${user?.username}`) ? '#c084fc' : 'var(--text-muted)' }}>
            Me
          </span>
        </button>
      </nav>

      {/* Profile Bottom Sheet */}
      {showProfileMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowProfileMenu(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6 pb-10 animate-slide-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />

            {/* User info */}
            <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl"
              style={{ background: 'rgba(147,51,234,0.08)', border: '1px solid rgba(147,51,234,0.15)' }}>
              <Avatar user={user} size="md" clickable={false} />
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {user?.fullName || user?.username}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>@{user?.username}</p>
              </div>
            </div>

            {/* Menu items */}
            <div className="space-y-1">
              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/5"
                onClick={() => { navigate(`/profile/${user?.username}`); setShowProfileMenu(false); }}
              >
                <span className="text-xl">👤</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>View Profile</span>
              </button>

              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/5"
                onClick={() => { navigate('/saved'); setShowProfileMenu(false); }}
              >
                <span className="text-xl">🔖</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Saved Shayari</span>
              </button>

              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/5"
                onClick={() => { navigate('/stories'); setShowProfileMenu(false); }}
              >
                <span className="text-xl">📚</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Stories</span>
              </button>

              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/5"
                onClick={() => { navigate('/my-stories'); setShowProfileMenu(false); }}
              >
                <span className="text-xl">✍️</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>My Stories</span>
              </button>

              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/5"
                onClick={() => { navigate('/leaderboard'); setShowProfileMenu(false); }}
              >
                <span className="text-xl">🏆</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Leaderboard</span>
              </button>

              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/5"
                onClick={() => { navigate('/clubs'); setShowProfileMenu(false); }}
              >
                <span className="text-xl">🤝</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Clubs</span>
              </button>

              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/5"
                onClick={() => { navigate('/settings'); setShowProfileMenu(false); }}
              >
                <span className="text-xl">⚙️</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Settings</span>
              </button>

              <div className="my-2" style={{ height: '1px', background: 'var(--border)' }} />

              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-red-500/10"
                onClick={() => { setShowProfileMenu(false); setShowLogoutConfirm(true); }}
              >
                <svg className="ml-0.5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                <span className="text-sm font-medium text-red-400">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="glass rounded-2xl p-8 max-w-xs w-full text-center animate-fade-in">
            <div className="text-4xl mb-4">👋</div>
            <h3 className="text-lg font-semibold mb-2">Leaving so soon?</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Your shayari will wait for you...</p>
            <div className="flex gap-3">
              <button className="btn-ghost flex-1 py-2.5 text-sm" onClick={() => setShowLogoutConfirm(false)}>
                Stay
              </button>
              <button
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create choice bottom sheet */}
      {showCreateMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowCreateMenu(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6 pb-10 animate-slide-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />

            <div className="space-y-1">
              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/5"
                onClick={() => { setShowCreateMenu(false); setShowCreate(true); }}
              >
                <span className="text-xl">✨</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Write Shayari</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>A short post, text or image</p>
                </div>
              </button>

              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/5"
                onClick={() => { setShowCreateMenu(false); navigate('/story/create'); }}
              >
                <span className="text-xl">📖</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Write Story</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Multi-chapter, long-form writing</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} />}
    </>
  );
}