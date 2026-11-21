/** Skeletons mirror the real layout so content doesn't jump when it streams in. */
export function ResultsSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading results">
      <div className="mb-3 flex justify-between">
        <div className="skeleton h-5 w-24" />
        <div className="skeleton h-8 w-40" />
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
            <div className="skeleton h-[30px] w-[30px]" />
            <div className="flex-1">
              <div className="skeleton h-3.5" style={{ width: `${40 + ((i * 23) % 35)}%` }} />
              <div className="skeleton mt-1.5 h-3 w-1/3" />
            </div>
            <div className="skeleton h-9 w-9 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelSkeleton({ height = 220 }: { height?: number }) {
  return <div className="skeleton w-full rounded-lg" style={{ height }} aria-busy="true" />;
}
