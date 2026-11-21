/**
 * OneAtlas mark: a triangulation station. A trig pillar's plan symbol (triangle
 * with a centre dot) inside a compass ring with a north tick: the point every
 * survey is measured from.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="13.5" stroke="var(--ink)" strokeWidth="1.3" />
      <circle cx="16" cy="16" r="10.5" stroke="var(--ink)" strokeWidth="0.6" strokeDasharray="1 2.2" />
      <path d="M16 1 V5" stroke="var(--copper)" strokeWidth="1.6" />
      <path d="M16 8.5 L23 21.5 H9 Z" fill="var(--copper)" />
      <circle cx="16" cy="17" r="1.8" fill="var(--surface)" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[21px] font-bold tracking-[0.14em] text-ink">OneAtlas</span>
        {!compact && <span className="water mt-[3px] text-[11px] text-ink-3">a survey of machine intelligence</span>}
      </span>
    </span>
  );
}
