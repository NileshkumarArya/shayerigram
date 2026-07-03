import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI } from '../services/api';
import { FeedSkeleton } from '../components/common/Skeleton';

function StatCard({ label, value, icon }) {
  return (
    <div className="glass rounded-xl p-4" style={{ border: '1px solid var(--border)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{icon} {label}</p>
      <p className="text-2xl font-bold gradient-text">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.getMyAnalytics()
      .then(({ data }) => setData(data))
      .catch(err => console.error('Analytics load error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FeedSkeleton count={3} />;

  if (!data) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">📊</div>
        <p className="font-shayari gradient-text">Analytics load nahi ho paayi</p>
      </div>
    );
  }

  // ── Locked state ─────────────────────────────────────────────────────────
  if (!data.unlocked) {
    const { current, required } = data.progress;
    const pct = Math.min(Math.round((current / required) * 100), 100);
    return (
      <div className="animate-fade-in max-w-md mx-auto text-center py-16">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold gradient-text mb-2">Analytics abhi locked hai</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Kam se kam {required} posts/stories publish karo apna Analytics Dashboard unlock karne ke liye.
        </p>
        <div className="w-full h-2.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: 'linear-gradient(135deg,#9333ea,#7c3aed)' }} />
        </div>
        <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>{current} / {required}</p>
        <Link to="/create" className="btn-primary inline-block px-6 py-2.5 text-sm">✨ Kuch likho</Link>
      </div>
    );
  }

  // ── Unlocked state ───────────────────────────────────────────────────────
  const o = data.overview;

  return (
    <div className="animate-fade-in w-full min-w-0">
      <div className="mb-6">
        <h1 className="text-2xl font-cinzel gradient-text mb-1">📊 Analytics</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tera performance, ek nazar mein</p>
      </div>

      {/* Overview grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard icon="📝" label="Posts" value={o.totalPosts} />
        <StatCard icon="📚" label="Stories" value={o.totalStories} />
        <StatCard icon="❤️" label="Post Likes" value={o.totalPostLikes} />
        <StatCard icon="👁️" label="Post Views" value={o.totalPostViews} />
        <StatCard icon="📖" label="Story Reads" value={o.totalStoryReads} />
        <StatCard icon="🔖" label="Bookmarks" value={o.totalStoryBookmarks} />
      </div>

      <div className="glass rounded-xl p-5 mb-6 text-center" style={{ border: '1px solid var(--border)' }}>
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>⚡ Engagement Rate</p>
        <p className="text-3xl font-bold gradient-text">{o.engagementRate}%</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>(likes + comments×2) ÷ (views + reads)</p>
      </div>

      {/* Top Posts */}
      {data.topPosts?.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--purple-light)' }}>
            🏆 Top Posts
          </h3>
          <div className="space-y-2">
            {data.topPosts.map((p, i) => (
              <Link key={p._id} to={`/post/${p._id}`}
                className="flex items-center gap-3 p-3 rounded-xl glass-hover"
                style={{ border: '1px solid var(--border)' }}>
                <span className="text-lg shrink-0">{['🥇','🥈','🥉'][i] || `#${i+1}`}</span>
                <p className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {p.title || p.content?.slice(0, 40) || 'Untitled'}
                </p>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>❤️ {p.likesCount}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Top Stories */}
      {data.topStories?.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--purple-light)' }}>
            📚 Top Stories
          </h3>
          <div className="space-y-2">
            {data.topStories.map((s, i) => (
              <Link key={s._id} to={`/story/${s._id}`}
                className="flex items-center gap-3 p-3 rounded-xl glass-hover"
                style={{ border: '1px solid var(--border)' }}>
                <span className="text-lg shrink-0">{['🥇','🥈','🥉'][i] || `#${i+1}`}</span>
                <p className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>👁️ {s.totalReads}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Chapter Drop-off Funnels */}
      {data.storyDropoff?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--purple-light)' }}>
            📉 Chapter Drop-off
          </h3>
          <div className="space-y-4">
            {data.storyDropoff.map(sd => {
              const maxReaders = Math.max(...sd.funnel.map(f => f.readersReached), 1);
              return (
                <div key={sd.storyId} className="glass rounded-xl p-4" style={{ border: '1px solid var(--border)' }}>
                  <p className="text-sm font-semibold mb-3 truncate" style={{ color: 'var(--text-primary)' }}>{sd.title}</p>
                  <div className="space-y-2">
                    {sd.funnel.map(f => (
                      <div key={f.chapterNumber} className="flex items-center gap-2">
                        <span className="text-xs w-16 shrink-0" style={{ color: 'var(--text-muted)' }}>
                          Ch. {f.chapterNumber}
                        </span>
                        <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-full rounded-full flex items-center justify-end pr-2"
                            style={{
                              width: `${Math.max((f.readersReached / maxReaders) * 100, 8)}%`,
                              background: 'linear-gradient(90deg,#7c3aed,#9333ea)',
                            }}>
                            <span className="text-[10px] font-semibold text-white">{f.readersReached}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}