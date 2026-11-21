export default function Loading() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 md:px-8" aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-3 h-3.5 w-24" />
      <div className="skeleton mb-2 h-9 w-80" />
      <div className="skeleton mb-8 h-4 w-[min(560px,90%)]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-32" />
        ))}
      </div>
    </div>
  );
}
