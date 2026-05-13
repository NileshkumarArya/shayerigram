import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import RightPanel from './RightPanel';
import MobileBottomNav from './MobileBottomNav';
import { notifAPI } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';

export default function Layout() {
  const [notifCount, setNotifCount] = useState(0);

  // ✅ Real-time notification via socket
  useSocket((data) => {
    // Increment unread count badge when notification arrives
    setNotifCount(prev => prev + 1);
  });

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data } = await notifAPI.unreadCount();
        setNotifCount(data.count);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Background orbs */}
      <div className="fixed pointer-events-none z-0">
        <div className="absolute w-[500px] h-[500px] rounded-full -top-48 -left-48 opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #9333ea, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full top-1/2 -right-48 opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute w-[300px] h-[300px] rounded-full bottom-0 left-1/3 opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #c084fc, transparent)', filter: 'blur(60px)' }} />
      </div>

      {/* Sidebar */}
      <Sidebar notifCount={notifCount} />

      {/* Main content */}
      <main className="flex-1 ml-16 xl:ml-64 pb-16 md:pb-0 relative z-10">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Outlet context={{ setNotifCount }} />
        </div>
      </main>

      {/* Right panel - desktop only */}
      <aside className="hidden lg:block w-80 shrink-0 relative z-10">
        <div className="sticky top-6 px-4 py-6 space-y-4">
          <RightPanel />
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <MobileBottomNav notifCount={notifCount} />
    </div>
  );
}
