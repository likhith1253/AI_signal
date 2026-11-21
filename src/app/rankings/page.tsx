import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { rankingsQuery, searchParamsToObject } from "@/lib/validation";
import { getRankings, listBenchmarks } from "@/server/queries/intelligence";
import { parseWeights } from "@/server/scoring/engine";
import { Container, Origin, PageHeader } from "@/components/ui/primitives";
import { RankingTable } from "@/components/rankings/RankingTable";
import { WeightTuner } from "@/components/rankings/WeightTuner";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/format";

export const metadata: Metadata = { title: "Rankings", description: "Category leaderboards from independent benchmarks, specifications and the Atlas composite score." };
export const revalidate = 300;

const CATEGORIES = [
  { key: "overall", label: "Atlas overall", hint: "Derived composite" },
  { key: "intelligence", label: "Reasoning & knowledge", hint: "AA Intelligence Index" },
  { key: "coding", label: "Coding", hint: "AA Coding Index" },
  { key: "agentic", label: "Agentic", hint: "AA Agentic Index" },
  { key: "design", label: "Design & UI", hint: "Design Arena Elo" },
  { key: "value", label: "Best value", hint: "Capability per dollar" },
  { key: "long-context", label: "Long context", hint: "Specification" },
  { key: "cheapest", label: "Cheapest", hint: "Specification" },
];

const FILTERS = [
  { key: "", label: "All types" },
  { key: "vision", label: "Vision", param: "capability=vision" },
  { key: "tools", label: "Tool calling", param: "capability=tools" },
  { key: "open-weights", label: "Open weights", param: "capability=open-weights" },
];

export default async function RankingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = searchParamsToObject(await searchParams);
  const parsed = rankingsQuery.safeParse(raw);
  const q = parsed.success ? parsed.data : rankingsQuery.parse({});
  const [r, benchmarks] = await Promise.all([getRankings({ ...q, weights: parseWeights(q.weights) }), listBenchmarks()]);
  const designBenches = benchmarks.filter((b) => b.category === "design" || b.category === "domain");
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = { category: q.category, benchmark: q.benchmark ?? null, capability: q.capability.join(",") || null, weights: q.weights ?? null, ...patch };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return `/rankings?${p.toString()}`;
  };

  return (
    <>
      <PageHeader sheet="05" eyebrow="Leaderboards" title="Rankings" description="Every leaderboard states where its numbers come from: an independent benchmark, a vendor specification, or a OneAtlas-derived composite. Different scales are never mixed in one ranking.">
        <div className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
          {CATEGORIES.map((c) => (
            <Link
              key={c.key}
              href={href({ category: c.key, benchmark: null, weights: null })}
              role="tab"
              aria-selected={q.category === c.key}
              className={cn(
                "flex shrink-0 flex-col rounded-none border px-3 py-1.5 text-left transition-colors",
                q.category === c.key ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:border-line-strong",
              )}
            >
              <span className="text-[13px] font-medium">{c.label}</span>
              <span className={cn("text-[10.5px]", q.category === c.key ? "text-bg/70" : "text-ink-3")}>{c.hint}</span>
            </Link>
          ))}
        </div>
      </PageHeader>

      <Container className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[22px] text-ink">{r.title}</h2>
              <Origin origin={r.origin} />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => {
                const active = f.key ? q.capability.includes(f.key) : q.capability.length === 0;
                return (
                  <Link key={f.key} href={href({ capability: f.key || null })} className={cn("h-7 rounded-none border px-2 text-[12px] leading-[26px]", active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:border-line-strong")}>
                    {f.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <p className="mb-4 max-w-[760px] text-[13px] text-ink-2">{r.description}</p>
          {r.rows.length ? <RankingTable rows={r.rows} scaleMax={r.origin === "external" && r.rows[0]?.value <= 100 ? 100 : undefined} /> : <div className="rounded-none border border-line bg-surface"><EmptyState title="No models qualify" body="Try removing the capability filter." /></div>}
        </div>

        <aside className="flex flex-col gap-4">
          {q.category === "overall" && (
            <Suspense>
              <WeightTuner />
            </Suspense>
          )}
          {(q.category === "design" || q.benchmark) && (
            <div className="rounded-none border border-line bg-surface p-4">
              <div className="mb-2 text-[13px] font-medium text-ink">Benchmark</div>
              <ul className="flex flex-col">
                {designBenches.map((b) => (
                  <li key={b.slug}>
                    <Link href={href({ category: "design", benchmark: b.slug })} className={cn("flex justify-between rounded px-2 py-1 text-[12.5px]", (q.benchmark ?? "design-arena-codecategories") === b.slug ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink")}>
                      <span className="truncate">{b.name.replace("Design Arena · ", "Arena · ")}</span>
                      <span className="num text-ink-3">{b.coverage}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-none border border-line bg-surface p-4 text-[12.5px] leading-relaxed text-ink-2">
            <div className="mb-1 text-[13px] font-medium text-ink">Reading these rankings</div>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <span className="text-accent">External</span> boards show scores exactly as published by the benchmark source.
              </li>
              <li>
                <span className="text-copper">Atlas-derived</span> boards are composites; the coverage percentage shows how much of the weight had data.
              </li>
              <li>Specification boards rank vendor-published numbers, not measured performance.</li>
            </ul>
            <Link href="/methodology" className="mt-2 inline-block text-accent hover:underline">
              Full methodology →
            </Link>
          </div>
        </aside>
      </Container>
    </>
  );
}
