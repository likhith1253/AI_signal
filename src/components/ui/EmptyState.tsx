import Link from "next/link";

/** Empty state with a small cartographic illustration: an unexplored grid square. */
export function EmptyState({ title, body, action }: { title: string; body?: React.ReactNode; action?: { href: string; label: string } | React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center" data-testid="empty-state">
      <svg width="88" height="64" viewBox="0 0 88 64" fill="none" aria-hidden className="mb-4">
        <g stroke="var(--line-strong)" strokeWidth="1">
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={`v${i}`} d={`M${8 + i * 18} 6v52`} strokeDasharray="2 3" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <path key={`h${i}`} d={`M4 ${10 + i * 15}h80`} strokeDasharray="2 3" />
          ))}
        </g>
        <rect x="26" y="25" width="18" height="15" fill="var(--copper-soft)" stroke="var(--copper)" strokeWidth="1.2" />
        <circle cx="35" cy="32.5" r="2" fill="var(--copper)" />
        <path d="M44 40l14 10" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="58" cy="50" r="5" stroke="var(--ink-3)" strokeWidth="1.2" />
      </svg>
      <div className="font-display text-[19px] text-ink">{title}</div>
      {body && <div className="mt-1 max-w-[420px] text-[13.5px] text-ink-2">{body}</div>}
      {action && typeof action === "object" && "href" in (action as object) ? (
        <Link href={(action as { href: string }).href} className="mt-4 rounded-none border border-line-strong px-3 py-1.5 text-[13px] text-ink hover:bg-surface-2">
          {(action as { label: string }).label}
        </Link>
      ) : (
        action && <div className="mt-4">{action as React.ReactNode}</div>
      )}
    </div>
  );
}
