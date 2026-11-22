/** Geological-unit identity marks. */

// [day stroke, day fill, night stroke, night fill]
const UNITS: [string, string, string, string][] = [
  ["#8a5a2b", "#e8d3b4", "#d8a46a", "#3a2a1a"], // ochre
  ["#4f6b45", "#d5dfc6", "#9fbf8f", "#1f2a1c"], // sage
  ["#47596b", "#d2dae0", "#9db2c6", "#1c232b"], // slate
  ["#9a4a32", "#ecd0c2", "#e59578", "#3a1f17"], // terracotta
  ["#6c4a5c", "#e2d2da", "#c39ab0", "#2a1c23"], // heather
  ["#6b6a2e", "#e2e0bf", "#c4c27a", "#28271a"], // olive
  ["#7a4b2a", "#e6cfbb", "#cf9a72", "#2e1f15"], // sienna
  ["#3f6a66", "#cfe0dc", "#8fc0b8", "#18292a"], // verdigris
];

type Pattern = (s: string) => React.ReactNode;
const PATTERNS: Pattern[] = [
  (s) => <path d="M-2 6 L6 -2 M-2 14 L14 -2 M6 14 L14 6" stroke={s} strokeWidth="1" />, // diagonal
  (s) => <path d="M-2 6 L6 -2 M-2 14 L14 -2 M6 14 L14 6 M-2 6 L6 14 M-2 -2 L14 14 M6 -2 L14 6" stroke={s} strokeWidth="0.8" />, // cross-hatch
  (s) => <g fill={s}><circle cx="3" cy="3" r="1.1" /><circle cx="9" cy="9" r="1.1" /></g>, // dots
  (s) => <path d="M0 3 H12 M0 9 H12" stroke={s} strokeWidth="1" />, // horizontal beds
  (s) => <path d="M0 4 Q3 1 6 4 T12 4 M0 10 Q3 7 6 10 T12 10" stroke={s} strokeWidth="0.9" fill="none" />, // waves
  (s) => <path d="M0 8 L3 4 L6 8 L9 4 L12 8" stroke={s} strokeWidth="0.9" fill="none" />, // chevrons
  (s) => <g fill={s}><path d="M3 1.5 L4.6 4.5 H1.4Z" /><path d="M9 7.5 L10.6 10.5 H7.4Z" /></g>, // breccia
  (s) => <path d="M3 0 V12 M9 0 V12 M0 6 H12" stroke={s} strokeWidth="0.8" />, // grid
];

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Back-compat for charts: [day ink, night ink] of the unit colour. */
export function markHue(slug: string): [string, string] {
  const u = UNITS[hash(slug) % UNITS.length];
  return [u[0], u[2]];
}

/** Geological-style unit symbol: capital + lowercase, e.g. "Op" for OpenAI, "Mi" for Mistral. */
export function unitSymbol(slug: string): string {
  const clean = slug.replace(/[^a-z]/gi, "").toLowerCase();
  if (!clean) return "Xx";
  const second = clean.slice(1).match(/[bcdfghjklmnpqrstvwxyz]/)?.[0] ?? clean[1] ?? "x";
  return clean[0].toUpperCase() + second;
}

export function LabMark({ slug, name, size = 28, className = "" }: { slug: string; name?: string; size?: number; className?: string }) {
  const h = hash(slug);
  const [ds, df, ns, nf] = UNITS[h % UNITS.length];
  const pattern = PATTERNS[(h >>> 4) % PATTERNS.length];
  const id = `u-${slug.replace(/[^a-z0-9]/gi, "")}`;
  const showSymbol = size >= 24;
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden border border-[var(--u-s)] dark:border-[var(--u-ns)] ${className}`}
      style={{ width: size, height: size, ["--u-s" as string]: ds, ["--u-f" as string]: df, ["--u-ns" as string]: ns, ["--u-nf" as string]: nf }}
      role="img"
      aria-label={name ? `${name} - map unit ${unitSymbol(slug)}` : undefined}
      title={name ? `${name} · unit ${unitSymbol(slug)}` : undefined}
    >
      <svg width={size} height={size} aria-hidden className="absolute inset-0">
        <defs>
          <pattern id={`${id}-d`} width="12" height="12" patternUnits="userSpaceOnUse">
            {pattern(ds)}
          </pattern>
          <pattern id={`${id}-n`} width="12" height="12" patternUnits="userSpaceOnUse">
            {pattern(ns)}
          </pattern>
        </defs>
        <rect width="100%" height="100%" className="fill-[var(--u-f)] dark:fill-[var(--u-nf)]" />
        <rect width="100%" height="100%" fill={`url(#${id}-d)`} className="opacity-60 dark:hidden" />
        <rect width="100%" height="100%" fill={`url(#${id}-n)`} className="hidden opacity-60 dark:block" />
      </svg>
      {showSymbol && (
        <span
          className="relative m-auto bg-[var(--u-f)] px-[2px] font-serif italic leading-none text-[var(--u-s)] dark:bg-[var(--u-nf)] dark:text-[var(--u-ns)]"
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {unitSymbol(slug)}
        </span>
      )}
    </span>
  );
}
