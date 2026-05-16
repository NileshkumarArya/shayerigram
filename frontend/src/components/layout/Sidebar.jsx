import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import CreatePostModal from '../feed/CreatePostModal';

const NavItem = ({ to, icon, label, badge, onClick }) => {
  const location = useLocation();
  const isActive = to ? location.pathname === to || location.pathname.startsWith(to + '/') : false;

  const content = (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group relative ${
        isActive ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
      style={isActive ? {
        background: 'linear-gradient(135deg, rgba(147,51,234,0.2), rgba(124,58,237,0.1))',
        borderLeft: '2px solid #9333ea',
        color: '#c084fc',
      } : {}}
      onClick={onClick}
    >
      <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </span>
      <span className={`font-medium text-sm hidden xl:block ${isActive ? 'text-purple-300' : ''}`}>{label}</span>
      {badge > 0 && (
        <span className="absolute left-7 top-2 min-w-4 h-4 px-1 rounded-full text-xs flex items-center justify-center font-bold"
          style={{ background: '#9333ea', color: 'white', fontSize: '0.65rem' }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </div>
  );

  if (to) return <Link to={to}>{content}</Link>;
  return content;
};

export default function Sidebar({ notifCount = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* hidden on mobile — shown only md and above */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-16 xl:w-64 flex-col z-40 glass-strong"
        style={{ borderRight: '1px solid var(--border)' }}>

        {/* Logo */}
        <div className="px-4 py-6 xl:px-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}>
              <span className="text-lg">✦</span>
            </div>
            <div className="hidden xl:block">
              <h1 className="text-base font-cinzel gradient-text leading-tight">ShayeriGram</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>जहाँ शब्द बोलते हैं</p>
            </div>
          </Link>
        </div>

        <div className="mx-4 mb-3" style={{ height: '1px', background: 'var(--border)' }} />

        {/* Navigation */}
        <nav className="flex-1 px-2 xl:px-4 space-y-1">
          <NavItem to="/"         icon="🏠" label="Home" />
          <NavItem to="/explore"  icon="🔍" label="Explore" />
          <NavItem to="/notifications" icon="🔔" label="Notifications" badge={notifCount} />
          <NavItem icon="✨" label="Create Post" onClick={() => setShowCreate(true)} />
          <NavItem to="/saved"    icon="🔖" label="Saved" />
          {user?.role === 'admin' && (
            <NavItem to="/admin" icon="⚙️" label="Admin Panel" />
          )}
          <NavItem to={user ? `/profile/${user.username}` : '/profile'} icon="👤" label="Profile" />
        </nav>

        {/* User section */}
        <div className="p-2 xl:p-4">
          <div className="mb-2">
            <NavItem icon="⚙️" label="Settings" to="/settings" />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl glass-hover cursor-pointer"
            onClick={() => navigate(`/profile/${user?.username}`)}>
            <Avatar user={user} size="sm" />
            <div className="hidden xl:block min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.username}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {user?.fullName || 'Shayar'}
              </p>
            </div>
            <button
              className="hidden xl:flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:bg-red-500/20 hover:text-red-400 text-gray-500"
              onClick={(e) => { e.stopPropagation(); setShowLogoutConfirm(true); }}
              title="Logout"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} />}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="glass rounded-2xl p-8 max-w-xs w-full mx-4 text-center animate-fade-in">
            <div className="text-4xl mb-4">👋</div>
            <h3 className="text-lg font-semibold mb-2">Leaving so soon?</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Your shayari will wait for you...</p>
            <div className="flex gap-3">
              <button className="btn-ghost flex-1 py-2.5 text-sm" onClick={() => setShowLogoutConfirm(false)}>Stay</button>
              <button className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}