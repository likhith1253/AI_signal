import type { Metadata } from "next";
import Link from "next/link";
import { getChangeFeed, getEngineStatus } from "@/server/queries/intelligence";
import { Container, PageHeader, Panel, Tag } from "@/components/ui/primitives";
import { PipelineDiagram } from "@/components/engine/PipelineDiagram";
import { ChangeFeed } from "@/components/ledger/ChangeFeed";
import { Expandable } from "@/components/models/Expandable";
import { cn, fmtDate, fmtRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Atlas Engine", description: "Live view of the OneAtlas ingestion pipeline: runs, stage timings, changesets, data sources and freshness." };
export const revalidate = 60;

const KINDS = [
  { key: "", label: "All" },
  { key: "PRICE_CHANGED", label: "Prices" },
  { key: "MODEL_ADDED,MODEL_REMOVED", label: "Models" },
  { key: "OFFERING_ADDED,OFFERING_REMOVED", label: "Providers" },
  { key: "MODEL_UPDATED", label: "Specs" },
  { key: "BENCHMARK_CHANGED", label: "Benchmarks" },
];

export default async function EnginePage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  const [e, feed] = await Promise.all([getEngineStatus(), getChangeFeed(60, sp.kind?.split(",").filter(Boolean))]);
  const lastApplied = e.jobs.find((j) => !j.dryRun && (j.status === "SUCCEEDED" || j.status === "PARTIAL"));
  const maxMs = Math.max(...e.jobs.map((j) => j.stages.reduce((a, s) => a + s.ms, 0)), 1);

  return (
    <>
      <PageHeader sheet="10"
        eyebrow="System"
        title={
          <>
            Atlas Engine <span className="text-ink-3">— plan, apply, diff</span>
          </>
        }
        description="Each sync runs the pipeline below. Before writing anything it compares the new catalogue with the database, and every difference is saved to the change log. Price history on model pages comes from these runs."
      />
      <Container className="flex flex-col gap-8 py-6">
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-[22px] text-ink">Pipeline</h2>
            {lastApplied && (
              <span className="text-[12.5px] text-ink-3">
                Last applied run {fmtRelative(lastApplied.finishedAt)} · <span className="num">{lastApplied.id.slice(-8)}</span> · {lastApplied.trigger}
              </span>
            )}
          </div>
          <PipelineDiagram stages={lastApplied?.stages ?? []} tables={e.tables} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title="Runs" flush>
            <ul data-testid="job-list">
              {e.jobs.map((j) => {
                const ms = j.stages.reduce((a, s) => a + s.ms, 0);
                const s = j.stats ?? {};
                return (
                  <li key={j.id} className="border-b border-line px-4 py-3 last:border-0">
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                      <span className={cn("h-2 w-2 rounded-full", j.status === "SUCCEEDED" ? "bg-positive" : j.status === "PARTIAL" ? "bg-amber" : j.status === "FAILED" ? "bg-negative" : "bg-ink-3")} title={j.status} />
                      <span className="text-ink">{fmtDate(j.startedAt)}</span>
                      <span className="text-ink-3">{fmtRelative(j.startedAt)}</span>
                      {j.dryRun ? <Tag tone="outline">plan</Tag> : j.isBaseline ? <Tag tone="amber">baseline</Tag> : <Tag tone="accent">apply</Tag>}
                      <Tag>{j.trigger}</Tag>
                      <span className="num ml-auto text-ink-3">{(ms / 1000).toFixed(1)}s</span>
                    </div>
                    <div className="num mt-1.5 flex flex-wrap gap-x-3 text-[11.5px] text-ink-2">
                      {j.isBaseline ? (
                        <span>baseline snapshot of {s.added ?? 0} models</span>
                      ) : (
                        <>
                          <span className="text-positive">+{s.added ?? 0} models</span>
                          <span className="text-negative">−{s.removed ?? 0}</span>
                          <span>~{s.updated ?? 0} updated</span>
                          <span className="text-copper">{s.priceChanges ?? 0} price changes</span>
                          <span>{(s.offeringsAdded ?? 0) + (s.offeringsRemoved ?? 0)} offering changes</span>
                        </>
                      )}
                      {j.errorCount > 0 && <span className="text-amber">{j.errorCount} rejected</span>}
                    </div>
                    {j.stages.length > 0 && (
                      <div className="mt-2 flex h-[5px] overflow-hidden rounded-none bg-surface-3" style={{ width: `${Math.max(12, (ms / maxMs) * 100)}%` }} title="stage time breakdown">
                        {j.stages.map((st, i) => (
                          <span key={st.stage} style={{ width: `${(st.ms / (ms || 1)) * 100}%`, background: i % 2 ? "var(--copper)" : "var(--accent)", opacity: 0.55 + (i % 3) * 0.15 }} title={`${st.stage} ${st.ms}ms`} />
                        ))}
                      </div>
                    )}
                    {j.errors.length > 0 && (
                      <div className="mt-1.5">
                        <Expandable label={<span className="text-[11.5px]">Validation &amp; processing errors ({j.errorCount})</span>}>
                          <ul className="num max-h-[160px] overflow-y-auto rounded border border-line bg-surface-2 p-2 text-[11px] text-ink-2">
                            {j.errors.map((er, i) => (
                              <li key={i} className="truncate">
                                <span className="text-ink">{er.ref}</span> - {er.message}
                              </li>
                            ))}
                          </ul>
                        </Expandable>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <div className="flex flex-col gap-6">
            <Panel title="Data sources & freshness" flush>
              <ul>
                {e.sources.map((s) => (
                  <li key={s.slug} className="border-b border-line px-4 py-2.5 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-[13px] text-ink hover:underline">
                        {s.name}
                      </a>
                      <Tag tone={s.kind === "API" ? "accent" : s.kind === "DERIVED" ? "copper" : "outline"}>{s.kind.toLowerCase()}</Tag>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">{s.description}</div>
                    <div className="mt-0.5 text-[11px] text-ink-3">Last success: {fmtRelative(s.lastSuccessAt)}</div>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Run it yourself">
              <div className="flex flex-col gap-2 text-[12px]">
                {[
                  ["Dry run - print the changeset", "npm run ingest -- --plan"],
                  ["Apply", "npm run ingest"],
                  ["Recompute scores only", "npm run derive"],
                  ["Remote (bearer token)", "POST /api/ingest?plan=1"],
                ].map(([l, c]) => (
                  <div key={c}>
                    <div className="text-ink-3">{l}</div>
                    <code className="num mt-0.5 block rounded border border-line bg-surface-2 px-2 py-1 text-ink">{c}</code>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <section id="ledger">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-[22px] text-ink">Change ledger</h2>
              <p className="text-[12.5px] text-ink-3">{e.tables.change.toLocaleString("en-US")} events recorded. Append-only; produced by the diff stage.</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {KINDS.map((k) => (
                <Link key={k.label} href={k.key ? `/engine?kind=${k.key}#ledger` : "/engine#ledger"} className={cn("h-7 rounded-none border px-2 text-[12px] leading-[26px]", (sp.kind ?? "") === k.key ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
                  {k.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-none border border-line bg-surface">
            <ChangeFeed items={feed} />
          </div>
        </section>
      </Container>
    </>
  );
}
