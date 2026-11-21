import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getRecommendations } from "@/server/queries/intelligence";
import { WORKLOADS } from "@/server/recommend/workloads";
import { DIMENSION_LABELS, type DimensionKey } from "@/server/scoring/engine";
import { Container, PageHeader, Tag } from "@/components/ui/primitives";
import { LabMark } from "@/components/identity/LabMark";
import { CapabilityIcons } from "@/components/models/bits";
import { CompareButton } from "@/components/models/CompareButton";
import { ConstraintBar } from "@/components/discover/ConstraintBar";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, fmtPrice, fmtTokens } from "@/lib/format";
import { capabilityLabel } from "@/components/models/bits";

export const metadata: Metadata = { title: "Workload finder", description: "Deterministic, explainable model recommendations for a specific workload." };
export const revalidate = 300;

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ workload?: string; maxPrice?: string; minContext?: string; openWeights?: string }> }) {
  const sp = await searchParams;
  const workload = WORKLOADS.find((w) => w.slug === sp.workload) ?? WORKLOADS[0];
  const maxPrice = sp.maxPrice ? Number(sp.maxPrice) : undefined;
  const minContext = sp.minContext ? Number(sp.minContext) : undefined;
  const r = await getRecommendations(workload.slug, { maxBlendedPrice: Number.isFinite(maxPrice) ? maxPrice : undefined, minContext: Number.isFinite(minContext) ? minContext : undefined, openWeightsOnly: sp.openWeights === "1" }, 12);
  const weights = Object.entries(workload.weights).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [DimensionKey, number][];
  const keep = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | null | undefined> = { workload: workload.slug, maxPrice: sp.maxPrice, minContext: sp.minContext, openWeights: sp.openWeights, ...patch };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return `/discover?${p.toString()}`;
  };

  return (
    <>
      <PageHeader sheet="03" eyebrow="Recommendation engine" title="Workload finder" description="Pick the job. OneAtlas applies the workload's hard requirements, weights the Atlas dimensions for that job and explains every pick. Deterministic: same data, same answer." />
      <Container className="grid gap-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-1" aria-label="Workloads">
          {WORKLOADS.map((w) => (
            <Link key={w.slug} href={keep({ workload: w.slug })} className={cn("rounded-none border px-3 py-2.5 transition-colors", w.slug === workload.slug ? "border-line-strong bg-surface shadow-[0_1px_0_var(--line)]" : "border-transparent hover:bg-surface-2")} data-testid="workload-option">
              <div className={cn("text-[13.5px]", w.slug === workload.slug ? "font-medium text-ink" : "text-ink-2")}>{w.name}</div>
              {w.slug === workload.slug && <div className="mt-0.5 text-[12px] leading-snug text-ink-3">{w.summary}</div>}
            </Link>
          ))}
        </aside>

        <div className="min-w-0">
          <div className="mb-4 grid gap-4 rounded-none border border-line bg-surface p-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-[10.5px] uppercase tracking-[0.08em] text-ink-3">Hard requirements</div>
              <div className="flex flex-wrap gap-1.5">
                {workload.requires.capabilities?.map((c) => <Tag key={c} tone="outline">{capabilityLabel(c)}</Tag>)}
                {workload.requires.minContext && <Tag tone="outline">≥ {fmtTokens(workload.requires.minContext)} context</Tag>}
                {workload.requires.knownPrice && <Tag tone="outline">Published price</Tag>}
                {workload.requires.types && <Tag tone="outline">Text models</Tag>}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[10.5px] uppercase tracking-[0.08em] text-ink-3">Ranking weights</div>
              <div className="flex h-2.5 overflow-hidden rounded-none">
                {weights.map(([k, v], i) => (
                  <span key={k} title={`${DIMENSION_LABELS[k]} ${Math.round(v * 100)}%`} style={{ width: `${v * 100}%`, background: i % 2 ? "var(--copper)" : "var(--accent)", opacity: 1 - i * 0.12 }} />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11.5px] text-ink-2">
                {weights.map(([k, v]) => (
                  <span key={k}>
                    {DIMENSION_LABELS[k]} <span className="num text-ink-3">{Math.round(v * 100)}%</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Suspense>
            <ConstraintBar />
          </Suspense>

          <div className="mb-3 mt-4 text-[12.5px] text-ink-3">
            {r?.results.length ?? 0} picks from {r?.candidates ?? 0} scored models · confidence-adjusted fit = weighted score × (0.75 + 0.25 × data coverage)
          </div>

          {!r || r.results.length === 0 ? (
            <div className="rounded-none border border-line bg-surface">
              <EmptyState title="No model meets every constraint" body="Relax the price ceiling or context minimum." action={{ href: `/discover?workload=${workload.slug}`, label: "Clear constraints" }} />
            </div>
          ) : (
            <Stagger className="flex flex-col gap-2">
              {r.results.map((rec, i) => (
                <StaggerItem key={rec.slug}>
                  <div className="grid gap-3 rounded-none border border-line bg-surface p-4 md:grid-cols-[40px_minmax(0,1fr)_200px]" data-testid="recommendation">
                    <div className={cn("num text-[20px]", i < 3 ? "text-copper" : "text-ink-3")}>{String(i + 1).padStart(2, "0")}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <LabMark slug={rec.model.lab.slug} size={26} />
                        <Link href={`/models/${rec.slug}`} className="truncate text-[15px] font-medium text-ink hover:underline">
                          {rec.name}
                        </Link>
                        <span className="text-[12px] text-ink-3">{rec.model.lab.name}</span>
                      </div>
                      <ul className="mt-2 flex flex-col gap-0.5 text-[12.5px] text-ink-2">
                        {rec.reasons.map((reason) => (
                          <li key={reason} className="flex gap-2">
                            <span className="text-accent">✓</span>
                            {reason}
                          </li>
                        ))}
                        {rec.caveats.map((c) => (
                          <li key={c} className="flex gap-2 text-ink-3">
                            <span className="text-amber">!</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <div className="text-right">
                        <span className="num text-[22px] text-ink">{rec.fit.toFixed(1)}</span>
                        <span className="ml-1 text-[11px] text-ink-3">fit</span>
                      </div>
                      <div className="num text-[11.5px] text-ink-3">
                        {fmtPrice(rec.model.pricing.blended)}/M · {fmtTokens(rec.model.contextLength)} · {Math.round(rec.confidence * 100)}% data
                      </div>
                      <div className="flex items-center gap-2">
                        <CapabilityIcons caps={rec.model.capabilities} max={4} />
                        <CompareButton slug={rec.slug} name={rec.name} lab={rec.model.lab.slug} />
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      </Container>
    </>
  );
}
