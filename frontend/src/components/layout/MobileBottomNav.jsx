import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CreatePostModal from '../feed/CreatePostModal';
import Avatar from '../common/Avatar';

export default function MobileBottomNav({ notifCount = 0 }) {
  const location = useLocation();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);

  const isActive = (path) => location.pathname === path;

  const tab = (to, icon, activeIcon, label) => (
    <Link to={to} className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5">
      <span className="text-xl">{isActive(to) ? activeIcon : icon}</span>
      <span className="text-[10px] font-medium" style={{ color: isActive(to) ? '#c084fc' : 'var(--text-muted)' }}>{label}</span>
    </Link>
  );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden glass-strong"
        style={{ borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tab('/', '🏠', '🏠', 'Home')}
        {tab('/explore', '🔍', '🔍', 'Explore')}

        {/* Create button */}
        <button
          onClick={() => setShowCreate(true)}
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
          <span className="text-xl">{isActive('/notifications') ? '🔔' : '🔔'}</span>
          {notifCount > 0 && (
            <span className="absolute top-1.5 right-1/4 min-w-4 h-4 px-1 rounded-full text-[10px] flex items-center justify-center font-bold"
              style={{ background: '#9333ea', color: 'white' }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
          <span className="text-[10px] font-medium" style={{ color: isActive('/notifications') ? '#c084fc' : 'var(--text-muted)' }}>Activity</span>
        </Link>

        {/* Profile */}
        <Link to={`/profile/${user?.username}`}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5">
          <div className={isActive(`/profile/${user?.username}`) ? 'ring-2 ring-purple-500 rounded-full' : ''}>
            <Avatar user={user} size="xs" clickable={false} />
          </div>
          <span className="text-[10px] font-medium" style={{ color: isActive(`/profile/${user?.username}`) ? '#c084fc' : 'var(--text-muted)' }}>Profile</span>
        </Link>
      </nav>

      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
