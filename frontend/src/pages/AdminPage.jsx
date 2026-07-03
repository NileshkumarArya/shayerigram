import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';
import Avatar from '../components/common/Avatar';
import LoadingSpinner from '../components/common/LoadingSpinner';

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }) {
  return (
    <div className="glass rounded-2xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
        style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value ?? '—'}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Report Row ────────────────────────────────────────────────────────────
function ReportRow({ report, onReview }) {
  const [open,    setOpen]    = useState(false);
  const [action,  setAction]  = useState('');
  const [loading, setLoading] = useState(false);

  const REASON_LABELS = {
    spam: '🚫 Spam', harassment: '😡 Harassment', hate_speech: '🤬 Hate Speech',
    inappropriate: '⚠️ Inappropriate', copyright: '©️ Copyright', other: '📝 Other',
  };

  const STATUS_STYLES = {
    open:     { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24',  label: 'Open' },
    reviewed: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa',  label: 'Reviewed' },
    resolved: { bg: 'rgba(34,197,94,0.15)',  color: '#86efac',  label: 'Resolved' },
    rejected: { bg: 'rgba(239,68,68,0.15)',  color: '#fca5a5',  label: 'Rejected' },
  };

  const st = STATUS_STYLES[report.status] || STATUS_STYLES.open;

  const handleReview = async (status) => {
    setLoading(true);
    try {
      await adminAPI.reviewReport(report._id, { status, actionTaken: action });
      onReview(report._id, status);
    } catch {}
    setLoading(false);
    setOpen(false);
  };

  return (
    <div className="glass rounded-xl overflow-hidden mb-2">
      {/* Row header */}
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-all"
        onClick={() => setOpen(!open)}>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: st.color }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: st.bg, color: st.color }}>{st.label}</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
              {REASON_LABELS[report.reason] || report.reason}
            </span>
            <span className="text-xs capitalize px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(147,51,234,0.1)', color: 'var(--purple-light)' }}>
              {report.targetType}
            </span>
          </div>
          <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
            Reported by: <strong style={{ color: 'var(--text-secondary)' }}>
              {report.reportedBy?.username || 'Unknown'}
            </strong>
            {' · '}{new Date(report.createdAt).toLocaleDateString('en-IN')}
          </p>
        </div>

        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pt-2 border-t animate-fade-in" style={{ borderColor: 'var(--border)' }}>
          {report.details && (
            <p className="text-sm mb-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
              "{report.details}"
            </p>
          )}

          {/* Target ID */}
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Target ID: <code className="text-purple-300">{String(report.targetId)}</code>
          </p>

          {/* Action textarea */}
          <textarea value={action} onChange={e => setAction(e.target.value)}
            placeholder="Action taken notes (optional)..."
            rows={2}
            className="input-field text-sm resize-none mb-3"
            style={{ fontSize: '0.8rem' }} />

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => handleReview('resolved')} disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(34,197,94,0.2)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' }}>
              ✅ Resolve
            </button>
            <button onClick={() => handleReview('reviewed')} disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
              👁️ Mark Reviewed
            </button>
            <button onClick={() => handleReview('rejected')} disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
              ❌ Reject
            </button>
            {report.targetType === 'post' && (
              <button
                onClick={async () => {
                  if (!confirm('Take down this post?')) return;
                  setLoading(true);
                  try { await adminAPI.takedownPost(String(report.targetId)); alert('Post taken down.'); }
                  catch { alert('Failed to take down post.'); }
                  setLoading(false);
                }}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                🗑️ Remove Post
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const [tab,         setTab]         = useState('overview');
  const [stats,       setStats]       = useState(null);
  const [reports,     setReports]     = useState([]);
  const [rFilter,     setRFilter]     = useState('open');
  const [loading,     setLoading]     = useState(true);
  const [searchUser,  setSearchUser]  = useState('');

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/', { replace: true });
  }, [user, navigate]);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await adminAPI.getStats();
      setStats(data);
    } catch {}
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getReports({ status: rFilter, limit: 50 });
      setReports(data.reports || []);
    } catch {}
    setLoading(false);
  }, [rFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'reports') loadReports();
  }, [tab, loadReports]);

  const handleReviewDone = (id, newStatus) => {
    setReports(prev => prev.map(r => r._id === id ? { ...r, status: newStatus } : r));
    loadStats(); // Refresh counts
  };

  const handleSuspend = async (userId, suspend) => {
    if (!confirm(`${suspend ? 'Suspend' : 'Unsuspend'} this user?`)) return;
    try {
      await adminAPI.suspendUser(userId, { suspend });
      alert(`User ${suspend ? 'suspended' : 'unsuspended'} successfully.`);
    } catch { alert('Action failed.'); }
  };

  if (!user || user.role !== 'admin') {
    return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>;
  }

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'reports',  label: '🚨 Reports' },
    { id: 'guide',    label: '📋 Guide' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Fixed header */}
      <div className="glass-strong sticky top-0 z-30 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm hover:opacity-80" style={{ color: 'var(--text-muted)' }}>← Back</Link>
          <div className="w-px h-4" style={{ background: 'var(--border)' }} />
          <h1 className="font-cinzel gradient-text text-lg">Admin Panel</h1>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(147,51,234,0.2)', color: 'var(--purple-light)', border: '1px solid rgba(147,51,234,0.3)' }}>
            {user.username}
          </span>
        </div>
        {stats?.openReports > 0 && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
            🚨 {stats.openReports} open reports
          </span>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 glass rounded-xl mb-6 w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab === t.id
                ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
                : { color: 'var(--text-muted)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div className="animate-fade-in space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Users"   value={stats?.totalUsers}   icon="👥" color="#9333ea" />
              <StatCard label="Total Posts"   value={stats?.totalPosts}   icon="📜" color="#3b82f6" />
              <StatCard label="Open Reports"  value={stats?.openReports}  icon="🚨" color="#f59e0b" />
              <StatCard label="Suspended"     value={stats?.suspendedUsers} icon="🚫" color="#ef4444" />
            </div>

            {/* Quick actions */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setTab('reports')}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                  🚨 Review Reports ({stats?.openReports || 0})
                </button>
                <button onClick={loadStats}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
                  style={{ background: 'rgba(147,51,234,0.15)', color: 'var(--purple-light)', border: '1px solid rgba(147,51,234,0.3)' }}>
                  🔄 Refresh Stats
                </button>
              </div>
            </div>

            {/* Suspend user by ID */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>User Actions</h3>
              <div className="flex gap-2">
                <input value={searchUser} onChange={e => setSearchUser(e.target.value)}
                  placeholder="Enter User ID to suspend..."
                  className="input-field text-sm flex-1" />
                <button
                  onClick={() => searchUser && handleSuspend(searchUser, true)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80 shrink-0"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                  Suspend
                </button>
                <button
                  onClick={() => searchUser && handleSuspend(searchUser, false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80 shrink-0"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' }}>
                  Unsuspend
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Copy User ID from MongoDB Compass (24 char hex)
              </p>
            </div>
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {tab === 'reports' && (
          <div className="animate-fade-in">
            {/* Filter */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {['open', 'reviewed', 'resolved', 'rejected', 'all'].map(f => (
                <button key={f} onClick={() => setRFilter(f)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all"
                  style={rFilter === f
                    ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {f}
                </button>
              ))}
              <button onClick={loadReports}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all ml-auto"
                style={{ background: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.3)', color: 'var(--purple-light)' }}>
                🔄 Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <div className="text-5xl mb-4">✅</div>
                <p className="font-shayari gradient-text text-lg">No {rFilter} reports</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Platform is clean!</p>
              </div>
            ) : (
              <div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  {reports.length} reports (click to expand)
                </p>
                {reports.map(r => (
                  <ReportRow key={r._id} report={r} onReview={handleReviewDone} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── GUIDE TAB ── */}
        {tab === 'guide' && (
          <div className="animate-fade-in space-y-4">
            <div className="glass rounded-2xl p-5">
              <h3 className="text-base font-semibold mb-3 gradient-text">Admin Guide</h3>
              <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {[
                  ['🔑 Make someone admin', 'Set the user\'s `role` field to `"admin"` in MongoDB Compass'],
                  ['🚨 Report flow', 'User taps "Report" → it appears in the Report table → you review it'],
                  ['✅ Resolve', 'Report genuine tha, action liya — mark resolved'],
                  ['❌ Reject', 'Report false/malicious tha — mark rejected'],
                  ['🗑️ Remove Post', 'Post ko `isTakenDown: true` karta hai — feed se hata deta hai'],
                  ['🚫 Suspend User', 'User won\'t be able to log in — unsuspend to restore access'],
                  ['📊 Stats', 'Real-time counts — Refresh dabao latest ke liye'],
                ].map(([title, desc]) => (
                  <div key={title} className="flex gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="shrink-0 text-base">{title.split(' ')[0]}</span>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {title.slice(2)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>API Endpoints</h3>
              <div className="space-y-1.5">
                {[
                  ['GET',   '/api/admin/stats',              'Platform stats'],
                  ['GET',   '/api/admin/reports?status=open','List reports'],
                  ['PATCH', '/api/admin/reports/:id',        'Review a report'],
                  ['PATCH', '/api/admin/posts/:id/takedown', 'Remove a post'],
                  ['PATCH', '/api/admin/users/:id/suspend',  'Suspend a user'],
                ].map(([method, path, desc]) => (
                  <div key={path} className="flex items-center gap-2 text-xs font-mono p-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <span className="shrink-0 font-bold w-12"
                      style={{ color: method === 'GET' ? '#86efac' : method === 'PATCH' ? '#93c5fd' : '#fca5a5' }}>
                      {method}
                    </span>
                    <span style={{ color: 'var(--purple-light)' }}>{path}</span>
                    <span className="ml-auto" style={{ color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
