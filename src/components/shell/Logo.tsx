/** OneAtlas mark: a meridian sphere — longitude arcs over a single latitude band. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.6" className="text-ink" />
      <ellipse cx="16" cy="16" rx="6" ry="13" stroke="currentColor" strokeWidth="1.4" className="text-ink" />
      <path d="M3.5 12.5h25M3.5 19.5h25" stroke="currentColor" strokeWidth="1.2" className="text-ink-3" />
      <circle cx="22" cy="12.5" r="2.4" className="fill-copper" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[19px] leading-none tracking-tight text-ink">
        One<span className="italic text-accent">Atlas</span>
      </span>
    </span>
  );
}
