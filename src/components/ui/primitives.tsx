import Link from "next/link";
import { cn } from "@/lib/format";

export function PageHeader({ eyebrow, title, description, actions, children }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="border-b border-line px-4 pb-6 pt-7 md:px-8">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-[760px]">
          {eyebrow && <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-copper">{eyebrow}</div>}
          <h1 className="font-display text-[30px] leading-[1.1] tracking-[-0.01em] text-ink md:text-[36px]">{title}</h1>
          {description && <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mx-auto mt-5 max-w-[1320px]">{children}</div>}
    </div>
  );
}

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-[1320px] px-4 md:px-8", className)}>{children}</div>;
}

export function Panel({ children, className, title, action, id, flush }: { children: React.ReactNode; className?: string; title?: React.ReactNode; action?: React.ReactNode; id?: string; flush?: boolean }) {
  return (
    <section id={id} className={cn("min-w-0 rounded-lg border border-line bg-surface", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-medium text-ink">{title}</h2>
          {action}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function SectionTitle({ children, action, kicker }: { children: React.ReactNode; action?: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {kicker && <div className="mb-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-3">{kicker}</div>}
        <h2 className="font-display text-[21px] leading-tight text-ink">{children}</h2>
      </div>
      {action}
    </div>
  );
}

type Tone = "neutral" | "accent" | "copper" | "amber" | "positive" | "negative" | "outline";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
  copper: "bg-copper-soft text-copper border-transparent",
  amber: "bg-[color-mix(in_oklab,var(--amber)_16%,transparent)] text-amber border-transparent",
  positive: "bg-[color-mix(in_oklab,var(--positive)_14%,transparent)] text-positive border-transparent",
  negative: "bg-[color-mix(in_oklab,var(--negative)_14%,transparent)] text-negative border-transparent",
  outline: "bg-transparent text-ink-2 border-line-strong",
};

export function Tag({ children, tone = "neutral", className, title }: { children: React.ReactNode; tone?: Tone; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex h-[20px] items-center gap-1 whitespace-nowrap rounded-[3px] border px-1.5 text-[11px] font-medium leading-none", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function LinkArrow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12.5px] text-ink-2 hover:text-ink">
      {children}
      <span className="transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] uppercase tracking-[0.08em] text-ink-3">{label}</div>
      <div className="num mt-1 text-[22px] leading-none text-ink">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}

/** Horizontal meter for a 0–100 score. Null renders a hatched "no data" bar. */
export function Meter({ value, className, tone = "accent", height = 6 }: { value: number | null | undefined; className?: string; tone?: "accent" | "copper" | "ink"; height?: number }) {
  const color = tone === "copper" ? "bg-copper" : tone === "ink" ? "bg-ink-2" : "bg-accent";
  if (value == null)
    return <div className={cn("w-full rounded-[2px] bg-[repeating-linear-gradient(135deg,var(--line)_0_3px,transparent_3px_6px)]", className)} style={{ height }} title="No data" />;
  return (
    <div className={cn("w-full overflow-hidden rounded-[2px] bg-surface-3", className)} style={{ height }}>
      <div className={cn("h-full rounded-[2px] transition-[width] duration-700 ease-out", color)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Origin({ origin }: { origin: "external" | "derived" | "specification" }) {
  if (origin === "external") return <Tag tone="accent" title="Published by an independent benchmark source">External benchmark</Tag>;
  if (origin === "derived") return <Tag tone="copper" title="Computed by OneAtlas from published data">Atlas-derived</Tag>;
  return <Tag tone="outline" title="Vendor-published specification">Specification</Tag>;
}
