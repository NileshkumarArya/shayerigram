import { optimizeImageUrl } from '../utils/image';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notifAPI } from '../services/api';
import Avatar from '../components/common/Avatar';
import LoadingSpinner from '../components/common/LoadingSpinner';

const TYPE_CONFIG = {
  like:    { emoji: '❤️', color: '#f87171', label: 'liked your shayari' },
  comment: { emoji: '💬', color: '#60a5fa', label: 'commented on your shayari' },
  follow:  { emoji: '👤', color: '#c084fc', label: 'started following you' },
  save:    { emoji: '🔖', color: '#fbbf24', label: 'saved your shayari' },
  mention: { emoji: '@',  color: '#34d399', label: 'mentioned you' },
  reply:   { emoji: '↩️', color: '#a78bfa', label: 'replied to your comment' },
};

function NotifItem({ notif }) {
  // ✅ FIX: actorId, actor, sender — teeno try karo
  const actor = notif.actorId || notif.actor || notif.sender;
  if (!actor) return null;

  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.like;
  // ✅ FIX: backend notif.post bhejta hai (normalized), fallback entityId object
  const post = notif.post || (typeof notif.entityId === 'object' ? notif.entityId : null);
  const isUnread = notif.isRead === false || notif.read === false;

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl transition-all glass-hover animate-fade-in ${isUnread ? 'border-l-2' : ''}`}
      style={
        isUnread
          ? { borderLeftColor: '#9333ea', background: 'rgba(147,51,234,0.05)' }
          : { border: '1px solid var(--border)' }
      }
    >
      <div className="relative shrink-0">
        <Avatar user={actor} size="md" />
        <span className="absolute -bottom-1 -right-1 text-sm">{cfg.emoji}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
          <Link
            to={`/profile/${actor.username}`}
            className="font-semibold hover:text-purple-300 transition-colors"
          >
            {actor.username}
          </Link>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>{cfg.label}</span>
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(notif.createdAt)}
        </p>
      </div>

      {post?._id && (
        <Link to={`/post/${post._id}`} className="shrink-0">
          {post.type === 'image' && post.image ? (
            <img
              src={optimizeImageUrl(post.image, { width: 96, height: 96, crop: 'fill' })}
              alt=""
              className="w-12 h-12 object-cover rounded-lg"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center p-1"
              style={{
                background: 'rgba(147,51,234,0.1)',
                border: '1px solid rgba(147,51,234,0.2)',
              }}
            >
              <span
                className="text-[9px] font-shayari text-center line-clamp-3"
                style={{ color: 'var(--text-muted)' }}
              >
                {post.content?.slice(0, 40)}
              </span>
            </div>
          )}
        </Link>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await notifAPI.getAll();
        setNotifications(data.notifications || []);
        await notifAPI.markRead();
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const FILTERS = ['all', 'like', 'comment', 'follow', 'save'];
  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
  const unread = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
    );
  }

  return (
    <div className="animate-fade-in w-full min-w-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-cinzel gradient-text">Notifications</h1>
          {unread > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {unread} new since your last visit
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto hide-scrollbar pb-1 w-full">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all"
            style={filter === f ? {
              background: 'linear-gradient(135deg,#9333ea,#7c3aed)',
              color: 'white',
            } : {
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}>
            {f === 'all' ? '🔔 All' : `${TYPE_CONFIG[f]?.emoji} ${f}`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 animate-fade-in">
          <div className="text-6xl mb-4 animate-float">🔔</div>
          <h3 className="text-lg font-shayari mb-2" style={{ color: 'var(--text-secondary)' }}>
            {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            When people like, comment or follow you, it'll show here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.some(n => new Date(n.createdAt).toDateString() === new Date().toDateString()) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1"
                style={{ color: 'var(--text-muted)' }}>Today</p>
              <div className="space-y-2">
                {filtered
                  .filter(n => new Date(n.createdAt).toDateString() === new Date().toDateString())
                  .map((n, i) => <NotifItem key={n._id || i} notif={n} />)}
              </div>
            </div>
          )}

          {filtered.some(n => new Date(n.createdAt).toDateString() !== new Date().toDateString()) && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1"
                style={{ color: 'var(--text-muted)' }}>Earlier</p>
              <div className="space-y-2">
                {filtered
                  .filter(n => new Date(n.createdAt).toDateString() !== new Date().toDateString())
                  .map((n, i) => <NotifItem key={n._id || i} notif={n} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}