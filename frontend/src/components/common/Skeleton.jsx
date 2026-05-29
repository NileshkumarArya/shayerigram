export function SkeletonBlock({ className = '', style }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function PostCardSkeleton() {
  return (
    <article className="card mb-4 p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <SkeletonBlock className="w-11 h-11 rounded-full shrink-0" />
        <div className="flex-1 min-w-0">
          <SkeletonBlock className="h-4 w-32 mb-2" />
          <SkeletonBlock className="h-3 w-24" />
        </div>
        <SkeletonBlock className="w-8 h-8 rounded-full" />
      </div>

      <SkeletonBlock className="h-4 w-40 mb-3" />
      <SkeletonBlock className="w-full rounded-xl mb-4" style={{ aspectRatio: '4 / 3' }} />

      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex gap-4">
          <SkeletonBlock className="h-6 w-12" />
          <SkeletonBlock className="h-6 w-12" />
          <SkeletonBlock className="h-6 w-8" />
        </div>
        <SkeletonBlock className="h-6 w-8" />
      </div>
    </article>
  );
}

export function FeedSkeleton({ count = 3 }) {
  return (
    <div className="animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}