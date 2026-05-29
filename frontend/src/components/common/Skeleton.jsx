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

export function ProfileSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="card mb-4 p-6">
        <div className="flex items-start gap-6">
          <SkeletonBlock className="w-24 h-24 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <SkeletonBlock className="h-6 w-36" />
              <SkeletonBlock className="h-5 w-16 rounded-full" />
            </div>
            <SkeletonBlock className="h-4 w-44 mb-5" />
            <div className="flex gap-6 mb-5">
              <div>
                <SkeletonBlock className="h-5 w-10 mx-auto mb-2" />
                <SkeletonBlock className="h-3 w-12" />
              </div>
              <div>
                <SkeletonBlock className="h-5 w-10 mx-auto mb-2" />
                <SkeletonBlock className="h-3 w-16" />
              </div>
              <div>
                <SkeletonBlock className="h-5 w-10 mx-auto mb-2" />
                <SkeletonBlock className="h-3 w-16" />
              </div>
            </div>
            <SkeletonBlock className="h-10 w-32 rounded-xl" />
          </div>
        </div>
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <SkeletonBlock className="h-4 w-full mb-2" />
          <SkeletonBlock className="h-4 w-2/3" />
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden mb-4">
        <SkeletonBlock className="h-8 w-24 rounded-full shrink-0" />
        <SkeletonBlock className="h-8 w-28 rounded-full shrink-0" />
        <SkeletonBlock className="h-8 w-20 rounded-full shrink-0" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonBlock key={i} className="aspect-square" style={{ borderRadius: '8px' }} />
        ))}
      </div>
    </div>
  );
}