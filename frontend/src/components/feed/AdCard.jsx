/**
 * AdCard — renders sponsored content slot in feed
 * Backend injects {type: 'ad'} objects into feed array
 * Client renders them differently
 */
export default function AdCard({ ad }) {
  const handleAdClick = async () => {
    // Track click on backend (server-authoritative)
    try {
      await fetch('/api/ads/event', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: ad._id, event: 'click' }),
      });
    } catch {}
    // In production: open ad URL
  };

  return (
    <div
      className="glass rounded-2xl p-4 mb-4 cursor-pointer hover:opacity-90 transition-opacity"
      style={{ border: '1px solid var(--border)' }}
      onClick={handleAdClick}
    >
      {/* Sponsored label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(147,51,234,0.1)', color: 'var(--purple-light)', border: '1px solid rgba(147,51,234,0.2)' }}>
          Sponsored
        </span>
      </div>

      {/* Ad placeholder content */}
      <div className="rounded-xl flex items-center justify-center"
        style={{ height: '120px', background: 'rgba(147,51,234,0.05)', border: '1px dashed rgba(147,51,234,0.2)' }}>
        <div className="text-center">
          <div className="text-3xl mb-1">✦</div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Advertisement</p>
          <p className="text-xs mt-1" style={{ color: 'var(--purple-light)' }}>
            Promote your shayari here
          </p>
        </div>
      </div>
    </div>
  );
}
