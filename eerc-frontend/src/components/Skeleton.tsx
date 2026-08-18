/**
 * Loading placeholders.
 *
 * Without these the app renders its empty state while reads are still in
 * flight, so a populated feed briefly claims nothing exists. Placeholders that
 * mirror the real element's shape keep the layout from jumping when data
 * lands.
 */ export const Shimmer = ({ className = "" }: { className?: string }) => (
  <div className={`bg-[var(--sheet)] rounded animate-pulse ${className}`} />
);

/** Mirrors a headline tile in the feed masthead. */
export const StatSkeleton = () => (
  <div className="bg-[var(--sheet)] border border-[var(--rule)] p-3.5">
    <Shimmer className="h-2 w-16" />
    <Shimmer className="h-5 w-20 mt-2" />
  </div>
);

/** Mirrors a feed row: avatar, title block, and the four-stat strip. */
export const RowSkeleton = () => (
  <div className="bg-[var(--sheet)] border border-[var(--rule)] p-5">
    <div className="flex items-start gap-4">
      <Shimmer className="w-11 h-11 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Shimmer className="h-3.5 w-32" />
          <Shimmer className="h-3 w-10" />
        </div>
        <Shimmer className="h-2.5 w-64 max-w-full mt-2.5" />
        <Shimmer className="h-2 w-48 max-w-full mt-2" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <Shimmer className="h-2 w-12" />
              <Shimmer className="h-3.5 w-16 mt-1.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
); export const FeedSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading raises">
    {Array.from({ length: rows }, (_, i) => (
      <RowSkeleton key={i} />
    ))}
  </div>
);
