export default function Loading() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 md:px-8" aria-busy="true" aria-label="Loading models">
      <div className="skeleton mb-3 h-4 w-28" />
      <div className="skeleton mb-8 h-9 w-72" />
      <div className="grid gap-6 lg:grid-cols-[248px_1fr]">
        <div className="hidden flex-col gap-3 lg:flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-5" style={{ width: `${60 + ((i * 17) % 35)}%` }} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="skeleton h-9" />
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      </div>
    </div>
  );
}
