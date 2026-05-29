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
export function GridSkeleton({ count = 9 }) {
  return (
    <div className="grid grid-cols-3 gap-2 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} className="aspect-square rounded-xl" />
      ))}
    </div>
  );
}

export function NotificationSkeleton({ count = 6 }) {
  return (
    <div className="space-y-2 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-xl" style={{ border: '1px solid var(--border)' }}>
          <SkeletonBlock className="w-11 h-11 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <SkeletonBlock className="h-4 w-48 mb-2" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
          <SkeletonBlock className="w-12 h-12 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}
export function PostPageSkeleton() {
  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <SkeletonBlock className="h-5 w-20 mb-4" />

      <article className="card">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="w-11 h-11 rounded-full shrink-0" />
            <div>
              <SkeletonBlock className="h-4 w-32 mb-2" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
          </div>
          <SkeletonBlock className="h-7 w-20 rounded-full" />
        </div>

        <div className="px-5 pb-3">
          <SkeletonBlock className="h-6 w-48" />
        </div>

        <SkeletonBlock className="w-full" style={{ aspectRatio: '4 / 3' }} />

        <div className="px-5 py-4 flex gap-3">
          <SkeletonBlock className="h-6 w-20 rounded-full" />
          <SkeletonBlock className="h-6 w-16 rounded-full" />
          <SkeletonBlock className="h-6 w-16 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex gap-5">
            <SkeletonBlock className="h-7 w-14" />
            <SkeletonBlock className="h-7 w-14" />
            <SkeletonBlock className="h-7 w-8" />
          </div>
          <SkeletonBlock className="h-7 w-8" />
        </div>

        <div className="p-5">
          <SkeletonBlock className="h-4 w-28 mb-4" />
          <div className="flex gap-3 mb-6">
            <SkeletonBlock className="w-9 h-9 rounded-full shrink-0" />
            <SkeletonBlock className="h-11 flex-1 rounded-xl" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <SkeletonBlock className="w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1">
                  <SkeletonBlock className="h-16 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}