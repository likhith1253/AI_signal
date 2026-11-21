/**
 * Deterministic geometric identity mark for a lab/provider. Instead of using
 * third-party logos (whose licensing varies) every organisation gets a unique
 * 3×3 glyph of quarter-arcs and blocks derived from a hash of its slug, in one
 * of eight muted hues. Same slug -> same mark, everywhere.
 */

const HUES = [
  ["#56632f", "#b2bf7d"], // olive
  ["#a3562b", "#dc996b"], // copper
  ["#7a5c2e", "#d0ac6d"], // ochre
  ["#3f6763", "#8fc0b8"], // verdigris
  ["#6b4f5e", "#c49bb0"], // plum
  ["#4d5a6b", "#9fb0c6"], // slate
  ["#7d4a3a", "#d08d76"], // terracotta
  ["#5a6145", "#b7bf98"], // sage
];

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function markHue(slug: string) {
  return HUES[hash(slug) % HUES.length];
}

export function LabMark({ slug, name, size = 28, className = "" }: { slug: string; name?: string; size?: number; className?: string }) {
  const h = hash(slug);
  const [dark, light] = markHue(slug);
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const bits = (h >>> (i * 3)) & 7;
    const x = (i % 3) * 10;
    const y = Math.floor(i / 3) * 10;
    if (bits === 0 || bits === 7) continue; // empty
    if (bits <= 2) {
      cells.push(<rect key={i} x={x + 1} y={y + 1} width={8} height={8} rx={1} />);
    } else {
      // quarter arc anchored at one of four corners
      const corner = bits - 3;
      const cx = x + (corner === 1 || corner === 2 ? 10 : 0);
      const cy = y + (corner >= 2 ? 10 : 0);
      const sx = corner === 1 || corner === 2 ? -1 : 1;
      const sy = corner >= 2 ? -1 : 1;
      cells.push(<path key={i} d={`M${cx} ${cy} L${cx + 9 * sx} ${cy} A9 9 0 0 ${sx * sy > 0 ? 1 : 0} ${cx} ${cy + 9 * sy} Z`} />);
    }
  }
  if (cells.length < 3) cells.push(<rect key="c" x={11} y={11} width={8} height={8} rx={1} />);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] border border-line bg-surface-2 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={name ? `${name} mark` : undefined}
    >
      <svg viewBox="-2 -2 34 34" width={size * 0.72} height={size * 0.72} aria-hidden>
        <g className="fill-[var(--mk-d)] dark:fill-[var(--mk-l)]" style={{ ["--mk-d" as string]: dark, ["--mk-l" as string]: light }}>
          {cells}
        </g>
      </svg>
    </span>
  );
}
