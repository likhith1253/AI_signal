import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getBenchmarkMatrix, listBenchmarks } from "@/server/queries/intelligence";
import { Container, PageHeader, Panel, Tag } from "@/components/ui/primitives";
import { LabMark } from "@/components/identity/LabMark";
import { cn, fmtRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Benchmarks", description: "Benchmark registry with sources, scales and coverage, plus a cross-benchmark percentile matrix." };
export const revalidate = 300;

const CAT_ORDER = ["intelligence", "coding", "agentic", "domain", "design"];
const CAT_LABEL: Record<string, string> = { intelligence: "Intelligence", coding: "Coding", agentic: "Agentic", domain: "Domain indices", design: "Design Arena" };

/** Percentile → background intensity. Colour encodes rank within a benchmark, never raw score. */
function heat(p: number | null) {
  if (p == null) return { background: "transparent" };
  const pct = Math.round(10 + p * 70);
  return { background: `color-mix(in oklab, var(--accent) ${pct}%, var(--surface))`, color: p > 0.6 ? "var(--accent-ink)" : "var(--ink)" };
}

export default async function BenchmarksPage({ searchParams }: { searchParams: Promise<{ set?: string }> }) {
  const sp = await searchParams;
  const all = await listBenchmarks();
  const sets: Record<string, { label: string; slugs: string[] }> = {
    core: { label: "Core indices", slugs: ["aa-intelligence-index", "aa-coding-index", "aa-agentic-index"] },
    domain: { label: "Domain indices", slugs: all.filter((b) => b.category === "domain").map((b) => b.slug).slice(0, 8) },
    design: { label: "Design Arena", slugs: ["design-arena-codecategories", ...all.filter((b) => b.category === "design" && b.slug !== "design-arena-codecategories").sort((a, b) => b.coverage - a.coverage).map((b) => b.slug)].slice(0, 7) },
  };
  const active = sets[sp.set ?? "core"] ?? sets.core;
  const matrix = await getBenchmarkMatrix(active.slugs, 25);
  const grouped = CAT_ORDER.map((c) => ({ c, list: all.filter((b) => b.category === c) })).filter((g) => g.list.length);

  return (
    <>
      <PageHeader
        eyebrow="Benchmark intelligence"
        title="Benchmarks"
        description={`${all.length} benchmarks from ${new Set(all.map((b) => b.source.name)).size} independent sources. Each result keeps its own scale; cross-benchmark views use percentiles so an Elo rating is never compared with a 0–100 index.`}
      />
      <Container className="flex flex-col gap-8 py-6">
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[22px] text-ink">Percentile matrix</h2>
              <p className="text-[12.5px] text-ink-3">Top 25 models on the first benchmark of the set. Cell = raw score; shade = percentile within that benchmark.</p>
            </div>
            <div className="flex gap-1">
              {Object.entries(sets).map(([k, s]) => (
                <Link key={k} href={`/benchmarks?set=${k}`} className={cn("h-7 rounded-[4px] border px-2.5 text-[12px] leading-[26px]", active === s ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[720px] text-[12.5px]" data-testid="benchmark-matrix">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="sticky left-0 bg-surface px-3 py-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">Model</th>
                  {matrix.benchmarks.map((b) => (
                    <th key={b.slug} className="px-2 py-2 text-[11px] font-medium text-ink-2">
                      <Link href={`/rankings?category=design&benchmark=${b.slug}`} className="hover:text-ink">
                        {b.name.replace("Design Arena · ", "").replace("AA ", "")}
                      </Link>
                      <div className="text-[10px] font-normal text-ink-3">{b.scaleLabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((r) => (
                  <tr key={r.model.slug} className="border-b border-line last:border-0">
                    <td className="sticky left-0 bg-surface px-3 py-1.5">
                      <Link href={`/models/${r.model.slug}`} className="flex items-center gap-2 hover:underline">
                        <LabMark slug={r.model.lab.slug} size={20} />
                        <span className="max-w-[220px] truncate text-ink">{r.model.name}</span>
                      </Link>
                    </td>
                    {r.cells.map((c, i) => (
                      <td key={i} className="px-1 py-1">
                        <div className="num rounded-[3px] px-2 py-1 text-center text-[12px]" style={heat(c?.percentile ?? null)} title={c ? `percentile ${Math.round((c.percentile ?? 0) * 100)}` : "not published"}>
                          {c ? (matrix.benchmarks[i].scaleLabel === "Elo rating" ? Math.round(c.score) : c.score.toFixed(1)) : <span className="text-ink-3">·</span>}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-[22px] text-ink">Registry</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {grouped.map((g) => (
              <Panel key={g.c} title={CAT_LABEL[g.c] ?? g.c} flush>
                <ul>
                  {g.list.map((b) => (
                    <li key={b.slug} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line px-4 py-2.5 last:border-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/rankings?category=${["intelligence", "coding", "agentic"].includes(g.c) ? g.c : "design"}${["intelligence", "coding", "agentic"].includes(g.c) ? "" : `&benchmark=${b.slug}`}`} className="truncate text-[13px] text-ink hover:underline">
                            {b.name}
                          </Link>
                          {b.isSynthetic ? <Tag tone="amber">Demo data</Tag> : <Tag tone="accent">External</Tag>}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-[11.5px] text-ink-3">{b.description}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-ink-3">
                          <span>{b.scaleLabel}</span>
                          {b.methodologyUrl && (
                            <a href={b.methodologyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">
                              {b.source.name} <ExternalLink size={10} />
                            </a>
                          )}
                          <span>updated {fmtRelative(b.source.lastSuccessAt)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="num text-[15px] text-ink">{b.coverage}</div>
                        <div className="text-[10.5px] text-ink-3">models</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-ink-3">No synthetic or demonstration benchmark data is loaded. Scores are attributed to their original publishers and retrieved via the OpenRouter public catalogue.</p>
        </section>
      </Container>
    </>
  );
}
