import Link from "next/link";
import { fmtRelative } from "@/lib/format";

export interface FeedItem {
  id: string;
  kind: string;
  subject: string;
  field: string | null;
  before: unknown;
  after: unknown;
  at: string;
  model: { slug: string; name: string; lab: { name: string } } | null;
}

const KIND: Record<string, { label: string; tone: string; glyph: string }> = {
  MODEL_ADDED: { label: "New model", tone: "text-positive", glyph: "+" },
  MODEL_REMOVED: { label: "Delisted", tone: "text-negative", glyph: "−" },
  MODEL_UPDATED: { label: "Spec change", tone: "text-amber", glyph: "~" },
  OFFERING_ADDED: { label: "New provider", tone: "text-accent", glyph: "+" },
  OFFERING_REMOVED: { label: "Provider dropped", tone: "text-negative", glyph: "−" },
  PRICE_CHANGED: { label: "Price change", tone: "text-copper", glyph: "$" },
  BENCHMARK_CHANGED: { label: "Benchmark update", tone: "text-accent", glyph: "◆" },
};

function describe(c: FeedItem) {
  if (c.kind === "PRICE_CHANGED" && c.field) {
    const [tag, comp] = c.field.split(":");
    const component = comp?.split("@")[0]?.toLowerCase().replace("_", " ");
    const b = typeof c.before === "number" ? c.before : null;
    const a = typeof c.after === "number" ? c.after : null;
    const pct = b && a != null ? Math.round(((a - b) / b) * 100) : null;
    return (
      <>
        {component} at <span className="num">{tag}</span>:{" "}
        <span className="num">
          {b == null ? "—" : `$${b}`} → {a == null ? String(c.after ?? "—") : `$${a}`}
        </span>
        {pct != null && <span className={pct < 0 ? "text-positive" : "text-negative"}> ({pct > 0 ? "+" : ""}{pct}%)</span>}
      </>
    );
  }
  if (c.kind === "OFFERING_ADDED" || c.kind === "OFFERING_REMOVED") return <span className="num">{c.field}</span>;
  if (c.kind === "MODEL_UPDATED")
    return (
      <>
        {c.field}: <span className="num">{JSON.stringify(c.before)} → {JSON.stringify(c.after)}</span>
      </>
    );
  if (c.kind === "BENCHMARK_CHANGED")
    return (
      <>
        <span className="num">{c.field}</span> {c.before == null ? "published" : `${c.before} →`} <span className="num">{String(c.after)}</span>
      </>
    );
  return null;
}

export function ChangeFeed({ items, compact = false }: { items: FeedItem[]; compact?: boolean }) {
  if (!items.length)
    return (
      <div className="px-4 py-8 text-center text-[13px] text-ink-3">
        The ledger is empty. The first ingest establishes a baseline; changes appear from the second run on.
      </div>
    );
  return (
    <ul data-testid="change-feed">
      {items.map((c) => {
        const k = KIND[c.kind] ?? { label: c.kind, tone: "text-ink-2", glyph: "·" };
        return (
          <li key={c.id} className="flex gap-3 border-b border-line px-4 py-2.5 last:border-0">
            <span className={`num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-surface-2 text-[11px] ${k.tone}`}>{k.glyph}</span>
            <div className="min-w-0 flex-1 text-[12.5px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate">
                  <span className={`${k.tone} mr-1.5 text-[11px] uppercase tracking-[0.06em]`}>{k.label}</span>
                  {c.model ? (
                    <Link href={`/models/${c.model.slug}`} className="text-ink hover:underline">
                      {c.model.name}
                    </Link>
                  ) : (
                    <span className="num text-ink">{c.subject}</span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-ink-3">{fmtRelative(c.at)}</span>
              </div>
              {!compact && <div className="mt-0.5 truncate text-ink-2">{describe(c)}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
