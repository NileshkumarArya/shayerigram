import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Avatar({
  user,
  size = 'md',
  ring = false,
  goldRing = false,
  clickable = true,
  showVerified = true,
  className = '',
}) {
  const [imgError, setImgError] = useState(false);

  const sizes = {
    xs:  { img: 'w-7 h-7',   text: 'text-xs',  badge: 'w-2.5 h-2.5' },
    sm:  { img: 'w-9 h-9',   text: 'text-sm',  badge: 'w-3 h-3' },
    md:  { img: 'w-11 h-11', text: 'text-base', badge: 'w-3.5 h-3.5' },
    lg:  { img: 'w-16 h-16', text: 'text-xl',  badge: 'w-4 h-4' },
    xl:  { img: 'w-24 h-24', text: 'text-3xl', badge: 'w-5 h-5' },
    '2xl': { img: 'w-32 h-32', text: 'text-4xl', badge: 'w-6 h-6' },
  };

  const s = sizes[size] || sizes.md;

  const initials = user?.username?.[0]?.toUpperCase() || '?';

  const imgSrc = !imgError && user?.avatar ? user.avatar : null;

  const avatarContent = (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {(ring || goldRing) ? (
        <div className={goldRing ? 'avatar-ring-gold' : 'avatar-ring'} style={{ padding: '2px', borderRadius: '50%' }}>
          <div className={`${s.img} rounded-full overflow-hidden`} style={{ background: 'var(--bg-primary)' }}>
            <div className="w-full h-full p-0.5 rounded-full overflow-hidden">
              {imgSrc ? (
                <img src={imgSrc} alt={user?.username} className="w-full h-full object-cover rounded-full"
                  onError={() => setImgError(true)} />
              ) : (
                <div className={`w-full h-full rounded-full flex items-center justify-center ${s.text} font-semibold`}
                  style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)', color: 'white' }}>
                  {initials}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={`${s.img} rounded-full overflow-hidden border`} style={{ borderColor: 'var(--border)' }}>
          {imgSrc ? (
            <img src={imgSrc} alt={user?.username} className="w-full h-full object-cover"
              onError={() => setImgError(true)} />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${s.text} font-semibold`}
              style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)', color: 'white' }}>
              {initials}
            </div>
          )}
        </div>
      )}

      {/* Online indicator */}
      {user?.isOnline && (
        <span className={`absolute bottom-0 right-0 ${s.badge} rounded-full border-2`}
          style={{ background: '#22c55e', borderColor: 'var(--bg-primary)' }} />
      )}

      {/* Verified badge */}
      {showVerified && user?.isVerified && (
        <span className={`absolute -bottom-0.5 -right-0.5 ${s.badge} rounded-full flex items-center justify-center`}
          style={{ background: '#9333ea', border: '1.5px solid var(--bg-primary)' }}>
          <svg viewBox="0 0 12 12" fill="white" className="w-full h-full p-0.5">
            <path d="M10 3L4.5 8.5 2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
        </span>
      )}
    </div>
  );

  if (clickable && user?.username) {
    return <Link to={`/profile/${user.username}`}>{avatarContent}</Link>;
  }
  return avatarContent;
}
