export default function LoadingSpinner({ fullScreen = false, size = 'md' }) {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div className={`${sizes[size]} relative`}>
        <div
          className="absolute inset-0 rounded-full border-2 border-purple-500/20"
          style={{ borderTopColor: '#9333ea', animation: 'spin 0.8s linear infinite' }}
        />
        <div
          className="absolute inset-1 rounded-full border-2 border-transparent"
          style={{ borderRightColor: '#c084fc', animation: 'spin 1.2s linear infinite reverse' }}
        />
      </div>
      {size === 'lg' && (
        <p className="text-sm font-cinzel gradient-text tracking-widest">ShayeriGram</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50"
        style={{ background: 'var(--bg-primary)' }}>
        {/* Background orbs */}
        <div className="absolute w-96 h-96 rounded-full top-0 left-0 opacity-10"
          style={{ background: 'radial-gradient(circle, #9333ea, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute w-96 h-96 rounded-full bottom-0 right-0 opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(80px)' }} />
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 rounded-full border-2 border-purple-500/20"
              style={{ borderTopColor: '#9333ea', animation: 'spin 0.8s linear infinite' }} />
            <div className="absolute inset-1 rounded-full border-2 border-transparent"
              style={{ borderRightColor: '#c084fc', animation: 'spin 1.2s linear infinite reverse' }} />
            <div className="absolute inset-3 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.3), transparent)' }} />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-cinzel gradient-text tracking-widest">ShayeriGram</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>जहाँ शब्द बोलते हैं...</p>
          </div>
        </div>
      </div>
    );
  }

  return spinner;
}
