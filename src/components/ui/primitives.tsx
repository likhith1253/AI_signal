import Link from "next/link";
import { cn } from "@/lib/format";

/**
 * Sheet title block. Every page is a numbered sheet of the atlas, titled the
 * way a survey map is: sheet number and index, then the name in map lettering
 * over a double rule.
 */
export function PageHeader({
  sheet,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  sheet?: string;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-4 pb-5 pt-6 md:px-8">
      <div className="mx-auto max-w-[1320px]">
        <div className="flex items-center gap-3 text-[10.5px] text-ink-3">
          {sheet && (
            <span className="letter border border-ink px-1.5 py-[1px] text-[11px] font-semibold text-ink">
              Sheet {sheet}
            </span>
          )}
          {eyebrow && <span className="letter">{eyebrow}</span>}
          <span className="h-px flex-1 bg-line-strong" />
          <span className="num hidden sm:inline">OneAtlas survey · ed. 2026.11</span>
        </div>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[820px]">
            <h1 className="font-display text-[34px] leading-[0.95] text-ink md:text-[46px]">{title}</h1>
            {description && <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-ink-2">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-5 border-t-[3px] border-double border-ink" />
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-[1320px] px-4 md:px-8", className)}>{children}</div>;
}

/** Legend box: ruled frame, lettered header strip, registration ticks on two corners. */
export function Panel({ children, className, title, action, id, flush }: { children: React.ReactNode; className?: string; title?: React.ReactNode; action?: React.ReactNode; id?: string; flush?: boolean }) {
  return (
    <section id={id} className={cn("ticked min-w-0 border border-line-strong bg-surface", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line-strong bg-surface-2/60 px-4 py-2">
          <h2 className="letter text-[12.5px] font-semibold text-ink">{title}</h2>
          {action}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function SectionTitle({ children, action, kicker }: { children: React.ReactNode; action?: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 border-b border-line-strong pb-2">
      <div>
        {kicker && <div className="water mb-0.5 text-[13px] text-copper">{kicker}</div>}
        <h2 className="font-display text-[24px] leading-none text-ink">{children}</h2>
      </div>
      {action}
    </div>
  );
}

type Tone = "neutral" | "accent" | "copper" | "amber" | "positive" | "negative" | "outline";
const TONES: Record<Tone, string> = {
  neutral: "border-line-strong text-ink-2 bg-surface-2",
  accent: "border-accent text-accent bg-transparent",
  copper: "border-copper text-copper bg-transparent",
  amber: "border-amber text-amber bg-transparent",
  positive: "border-positive text-positive bg-transparent",
  negative: "border-negative text-negative bg-transparent",
  outline: "border-line-strong text-ink-2 bg-transparent",
};

export function Tag({ children, tone = "neutral", className, title }: { children: React.ReactNode; tone?: Tone; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("letter inline-flex h-[18px] items-center gap-1 whitespace-nowrap border px-1.5 text-[10.5px] font-semibold leading-none", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function LinkArrow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="letter group inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11.5px] font-semibold text-ink-2 hover:text-copper">
      {children}
      <span className="transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="letter text-[10.5px] text-ink-3">{label}</div>
      <div className="num mt-1.5 text-[20px] leading-none text-ink">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}

/**
 * Scale-bar meter for a 0–100 value: filled bar over quarter ticks, like the
 * scale bar in a map's margin. Null renders hachure ("not surveyed").
 */
export function Meter({ value, className, tone = "accent", height = 6 }: { value: number | null | undefined; className?: string; tone?: "accent" | "copper" | "ink"; height?: number }) {
  const color = tone === "copper" ? "bg-copper" : tone === "ink" ? "bg-ink-2" : "bg-accent";
  if (value == null) return <div className={cn("hatch w-full border border-line", className)} style={{ height }} title="Not surveyed — no data" />;
  return (
    <div
      className={cn("relative w-full border border-line-strong bg-surface", className)}
      style={{ height, backgroundImage: "linear-gradient(90deg, transparent calc(25% - 1px), var(--line-strong) calc(25% - 1px) 25%, transparent 25% calc(50% - 1px), var(--line-strong) calc(50% - 1px) 50%, transparent 50% calc(75% - 1px), var(--line-strong) calc(75% - 1px) 75%, transparent 75%)" }}
    >
      <div className={cn("h-full transition-[width] duration-700 ease-out", color)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Origin({ origin }: { origin: "external" | "derived" | "specification" }) {
  if (origin === "external") return <Tag tone="accent" title="Published by an independent benchmark source">External benchmark</Tag>;
  if (origin === "derived") return <Tag tone="copper" title="Computed by OneAtlas from published data">Atlas-derived</Tag>;
  return <Tag tone="outline" title="Vendor-published specification">Specification</Tag>;
}
