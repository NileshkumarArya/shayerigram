/**
 * ✅ Multi-select category picker
 * Reusable component for CreatePost, CreatePostModal, EditPost
 * User can select 1-3 categories
 */
const CATEGORY_CONFIG = [
  { name: 'Love',         emoji: '❤️',  color: '#ef4444' },
  { name: 'Sad',          emoji: '💧',  color: '#3b82f6' },
  { name: 'Motivational', emoji: '⚡',  color: '#f59e0b' },
  { name: 'Funny',        emoji: '😄',  color: '#f97316' },
  { name: 'Spiritual',    emoji: '🕊️', color: '#10b981' },
  { name: 'Nature',       emoji: '🌿',  color: '#84cc16' },
  { name: 'Life',         emoji: '🌙',  color: '#8b5cf6' },
  { name: 'Friendship',   emoji: '🤝',  color: '#06b6d4' },
  { name: 'Patriotic',    emoji: '🇮🇳', color: '#f59e0b' },
  { name: 'Poetry',       emoji: '🪶',  color: '#a855f7' },
  { name: 'Other',        emoji: '📝',  color: '#9ca3af' },
];

export default function CategorySelect({ selected = [], onChange, maxSelect = 3 }) {
  const toggle = (name) => {
    if (selected.includes(name)) {
      // Remove — but must keep at least 1
      if (selected.length > 1) onChange(selected.filter(c => c !== name));
    } else {
      // Add — max 3
      if (selected.length < maxSelect) onChange([...selected, name]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Category <span style={{ color: 'var(--purple-light)' }}>({selected.length}/{maxSelect})</span>
        </label>
        {selected.length >= maxSelect && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Max {maxSelect} selected</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {CATEGORY_CONFIG.map(cat => {
          const isSelected = selected.includes(cat.name);
          const isDisabled = !isSelected && selected.length >= maxSelect;

          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => toggle(cat.name)}
              disabled={isDisabled}
              className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all"
              style={{
                background: isSelected ? `${cat.color}25` : 'rgba(255,255,255,0.04)',
                border:     isSelected ? `2px solid ${cat.color}` : '1px solid var(--border)',
                transform:  isSelected ? 'scale(1.05)' : 'scale(1)',
                opacity:    isDisabled ? 0.4 : 1,
                cursor:     isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <span className="text-base">{cat.emoji}</span>
              <span className="text-xs font-medium leading-tight text-center"
                style={{ color: isSelected ? cat.color : 'var(--text-secondary)', fontSize: '0.65rem' }}>
                {cat.name}
              </span>
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full"
                  style={{ background: cat.color }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected tags display */}
      {selected.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {selected.map(name => {
            const cat = CATEGORY_CONFIG.find(c => c.name === name);
            return (
              <span key={name}
                className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer"
                style={{ background: `${cat?.color}20`, color: cat?.color, border: `1px solid ${cat?.color}40` }}
                onClick={() => toggle(name)}>
                {cat?.emoji} {name} ✕
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { CATEGORY_CONFIG };
