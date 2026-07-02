import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { exploreAPI } from '../services/api';
import Avatar from '../components/common/Avatar';
import { FeedSkeleton } from '../components/common/Skeleton';

const TABS = [
  { id: 'writers', label: '✍️ Top Writers' },
  { id: 'shayars', label: '📜 Top Shayars' },
  { id: 'stories', label: '📖 Top Stories' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [tab,     setTab]     = useState('writers');
  const [period,  setPeriod]  = useState('all'); // 'all' | 'weekly'
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await exploreAPI.getLeaderboard(tab, period);
      setResults(data.results || []);
    } catch (err) {
      console.error('Leaderboard load error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [tab, period]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-fade-in w-full min-w-0">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-cinzel gradient-text mb-1">🏆 Leaderboard</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Top voices of ShayeriGram</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl glass mb-3 w-fit overflow-x-auto hide-scrollbar">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all"
            style={tab === t.id
              ? { background: 'linear-gradient(135deg,#9333ea,#7c3aed)', color: 'white' }
              : { color: 'var(--text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Period toggle — writers doesn't support weekly (follower count is a snapshot) */}
      {tab !== 'writers' && (
        <div className="flex gap-1 p-1 rounded-xl glass mb-5 w-fit">
          {[{ id: 'all', label: 'All Time' }, { id: 'weekly', label: 'This Week' }].map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={period === p.id
                ? { background: 'rgba(147,51,234,0.2)', color: 'var(--purple-light)' }
                : { color: 'var(--text-muted)' }}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      {tab === 'writers' && <div className="mb-5" />}

      {loading ? (
        <FeedSkeleton count={4} />
      ) : results.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🏆</div>
          <p className="font-shayari gradient-text">Koi rankings nahi mili</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Zyada creators aane pe yahan dikhega</p>
        </div>
      ) : tab === 'stories' ? (
        <div className="space-y-2">
          {results.map((s, i) => (
            <Link key={s._id} to={`/story/${s._id}`}
              className="flex items-center gap-3 p-3 rounded-xl glass-hover"
              style={{ border: '1px solid var(--border)' }}>
              <span className="w-8 text-center text-lg font-bold shrink-0" style={{ color: 'var(--text-muted)' }}>
                {MEDALS[i] || `#${i + 1}`}
              </span>
              <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0"
                style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
                {s.coverImage && <img src={s.coverImage} alt={s.title} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>by {s.author?.username}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold" style={{ color: 'var(--purple-light)' }}>❤️ {s.totalLikes || 0}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>👁️ {s.totalReads || 0}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((u, i) => (
            <Link key={u._id} to={`/profile/${u.username}`}
              className="flex items-center gap-3 p-3 rounded-xl glass-hover"
              style={{ border: '1px solid var(--border)' }}>
              <span className="w-8 text-center text-lg font-bold shrink-0" style={{ color: 'var(--text-muted)' }}>
                {MEDALS[i] || `#${i + 1}`}
              </span>
              <Avatar user={u} size="md" clickable={false} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{u.username}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {tab === 'writers'
                    ? `${u.followersCount || 0} followers`
                    : `${u.totalLikes || 0} likes · ${u.postsCount || 0} posts`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}