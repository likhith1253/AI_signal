import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Check, Minus } from "lucide-react";
import { compareModels } from "@/server/queries/intelligence";
import { Container, Meter, PageHeader, Tag } from "@/components/ui/primitives";
import { LabMark } from "@/components/identity/LabMark";
import { ScoreDial, TypeTag, capabilityLabel } from "@/components/models/bits";
import { AddModel, CompareSync, DiffToggle, RemoveModel } from "@/components/compare/CompareControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, fmtDate, fmtPrice, fmtTokens } from "@/lib/format";
import { MAX_COMPARE } from "@/lib/constants";

export const metadata: Metadata = { title: "Compare models", description: "Side-by-side comparison of specifications, pricing, capabilities, benchmarks and Atlas scores." };
export const dynamic = "force-dynamic";

type Cell = { display: React.ReactNode; value: number | string | boolean | null };
type Row = { label: string; hint?: string; cells: Cell[]; better?: "high" | "low" };

function bestIndex(row: Row): Set<number> {
  if (!row.better) return new Set();
  const nums = row.cells.map((c) => (typeof c.value === "number" ? c.value : null));
  const valid = nums.filter((n): n is number => n != null);
  if (valid.length < 2) return new Set();
  const target = row.better === "high" ? Math.max(...valid) : Math.min(...valid);
  if (valid.every((v) => v === target)) return new Set();
  return new Set(nums.flatMap((n, i) => (n === target ? [i] : [])));
}

function differs(row: Row) {
  const vals = row.cells.map((c) => JSON.stringify(c.value));
  return new Set(vals).size > 1;
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ models?: string; diff?: string }> }) {
  const sp = await searchParams;
  const slugs = (sp.models ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_COMPARE);
  const data = slugs.length ? await compareModels(slugs) : null;
  const models = data?.models ?? [];
  const onlyDiff = sp.diff === "1";
  const cols = models.length + (models.length < MAX_COMPARE ? 1 : 0);

  const has = (m: (typeof models)[number], cap: string) => m.capabilities.some((c) => c.slug === cap);
  const allCaps = [...new Set(models.flatMap((m) => m.capabilities.map((c) => c.slug)))];

  const sections: { title: string; note?: string; rows: Row[] }[] = data
    ? [
        {
          title: "Atlas Intelligence Score",
          note: "OneAtlas composite (atlas-v1). Dimensions are 0–100; missing data is shown as hatched, not zero.",
          rows: [
            { label: "Overall", better: "high", cells: models.map((m) => ({ value: m.score?.overall ?? null, display: m.score?.overall == null ? "—" : m.score.overall.toFixed(1) })) },
            { label: "Data coverage", better: "high", cells: models.map((m) => ({ value: m.score ? Math.round(m.score.confidence * 100) : null, display: m.score ? `${Math.round(m.score.confidence * 100)}%` : "—" })) },
            ...data.dimensions.map((d) => ({
              label: d.label,
              better: "high" as const,
              cells: d.values.map((v) => ({
                value: v,
                display: (
                  <span className="flex items-center gap-2">
                    <Meter value={v} className="max-w-[120px]" />
                    <span className="num w-7 text-right">{v == null ? "—" : Math.round(v)}</span>
                  </span>
                ),
              })),
            })),
          ],
        },
        {
          title: "Pricing",
          note: "Cheapest active provider for each model, USD per 1M tokens.",
          rows: [
            { label: "Input", better: "low", cells: models.map((m) => ({ value: m.pricing.input, display: fmtPrice(m.pricing.input) })) },
            { label: "Output", better: "low", cells: models.map((m) => ({ value: m.pricing.output, display: fmtPrice(m.pricing.output) })) },
            { label: "Blended 3:1", better: "low", cells: models.map((m) => ({ value: m.pricing.blended, display: fmtPrice(m.pricing.blended) })) },
            {
              label: "Cheapest via",
              cells: models.map((m) => {
                const priced = m.offerings
                  .filter((o) => o.isActive)
                  .map((o) => ({ o, v: o.prices.find((p) => p.component === "INPUT" && p.minPromptTokens === 0)?.amount ?? null }))
                  .filter((x) => x.v != null)
                  .sort((a, b) => (a.v as number) - (b.v as number));
                return { value: priced[0]?.o.provider.name ?? null, display: priced[0]?.o.provider.name ?? "—" };
              }),
            },
            { label: "Active providers", better: "high", cells: models.map((m) => ({ value: m.offerings.filter((o) => o.isActive).length, display: m.offerings.filter((o) => o.isActive).length })) },
          ],
        },
        {
          title: "Specifications",
          rows: [
            { label: "Context window", better: "high", cells: models.map((m) => ({ value: m.contextLength, display: fmtTokens(m.contextLength) })) },
            { label: "Max output", better: "high", cells: models.map((m) => ({ value: m.maxOutputTokens, display: fmtTokens(m.maxOutputTokens) })) },
            { label: "Input modalities", cells: models.map((m) => ({ value: m.inputModalities.join(","), display: m.inputModalities.join(", ") || "—" })) },
            { label: "Output modalities", cells: models.map((m) => ({ value: m.outputModalities.join(","), display: m.outputModalities.join(", ") || "—" })) },
            { label: "Released", cells: models.map((m) => ({ value: m.releasedAt, display: fmtDate(m.releasedAt) })) },
            { label: "Open weights", cells: models.map((m) => ({ value: m.isOpenWeights, display: m.isOpenWeights ? "Yes" : "No" })) },
            { label: "Knowledge cutoff", cells: models.map((m) => ({ value: m.knowledgeCutoff, display: m.knowledgeCutoff ?? "—" })) },
          ],
        },
        {
          title: "Capabilities",
          rows: allCaps.map((cap) => ({
            label: capabilityLabel(cap),
            cells: models.map((m) => ({
              value: has(m, cap),
              display: has(m, cap) ? <Check size={15} className="text-accent" aria-label="yes" /> : <Minus size={15} className="text-ink-3" aria-label="no" />,
            })),
          })),
        },
        {
          title: "Benchmarks",
          note: "Raw scores as published. Highlighting compares models only within the same benchmark and scale.",
          rows: data.benchmarks.map((b) => ({
            label: b.name.replace("Design Arena · ", "Arena · "),
            hint: b.scaleLabel,
            better: "high" as const,
            cells: b.values.map((v) => ({
              value: v?.score ?? null,
              display: v ? (
                <span className="num">
                  {b.scaleLabel === "Elo rating" ? Math.round(v.score) : v.score.toFixed(1)}
                  <span className="ml-1.5 text-[10.5px] text-ink-3">p{v.percentile == null ? "—" : Math.round(v.percentile * 100)}</span>
                </span>
              ) : (
                <span className="text-ink-3">not published</span>
              ),
            })),
          })),
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Comparison"
        title="Compare models"
        description="Add up to four models. The selection is saved as you browse and the URL is shareable."
        actions={models.length > 1 ? <Suspense><DiffToggle /></Suspense> : undefined}
      />
      <Suspense>
        <CompareSync resolved={models.map((m) => ({ slug: m.slug, name: m.name, lab: m.lab.slug }))} />
      </Suspense>
      <Container className="py-6">
        {data?.missing.length ? (
          <div className="mb-4 rounded-md border border-line bg-copper-soft px-3 py-2 text-[12.5px] text-copper">Not found and skipped: {data.missing.join(", ")}</div>
        ) : null}

        {models.length === 0 ? (
          <div className="grid gap-6 md:grid-cols-[1fr_280px]">
            <div className="rounded-lg border border-line bg-surface">
              <EmptyState title="Nothing to compare yet" body="Add models with the + button on any model row, or search below. Your selection persists across pages." action={{ href: "/models", label: "Browse models" }} />
            </div>
            <Suspense>
              <AddModel />
            </Suspense>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[680px]">
              {/* column headers */}
              <div className="sticky top-14 z-20 grid gap-3 bg-bg py-3" style={{ gridTemplateColumns: `180px repeat(${cols}, minmax(0, 1fr))` }}>
                <div />
                {models.map((m) => (
                  <div key={m.slug} className="rounded-lg border border-line bg-surface p-3" data-testid="compare-column">
                    <div className="flex items-start justify-between gap-2">
                      <LabMark slug={m.lab.slug} size={26} />
                      <Suspense>
                        <RemoveModel slug={m.slug} name={m.name} />
                      </Suspense>
                    </div>
                    <Link href={`/models/${m.slug}`} className="mt-2 block truncate text-[14px] font-medium text-ink hover:underline">
                      {m.name}
                    </Link>
                    <div className="mt-0.5 truncate text-[12px] text-ink-3">{m.lab.name}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <TypeTag type={m.type} />
                      <ScoreDial score={m.score?.overall} confidence={m.score?.confidence} size={34} />
                    </div>
                  </div>
                ))}
                {models.length < MAX_COMPARE && (
                  <Suspense>
                    <AddModel />
                  </Suspense>
                )}
              </div>

              {sections.map((s) => {
                const rows = onlyDiff ? s.rows.filter(differs) : s.rows;
                if (!rows.length) return null;
                return (
                  <section key={s.title} className="mt-5">
                    <div className="mb-1.5 flex items-baseline gap-3">
                      <h2 className="font-display text-[18px] text-ink">{s.title}</h2>
                      {s.note && <span className="text-[11.5px] text-ink-3">{s.note}</span>}
                    </div>
                    <div className="overflow-hidden rounded-lg border border-line bg-surface">
                      {rows.map((r) => {
                        const best = bestIndex(r);
                        return (
                          <div key={r.label} className="grid items-center gap-3 border-b border-line px-0 last:border-0" style={{ gridTemplateColumns: `180px repeat(${cols}, minmax(0, 1fr))` }}>
                            <div className="px-3 py-2 text-[12.5px] text-ink-2">
                              {r.label}
                              {r.hint && <div className="text-[10.5px] text-ink-3">{r.hint}</div>}
                            </div>
                            {r.cells.map((c, i) => (
                              <div key={i} className={cn("py-2 pr-3 text-[13px] text-ink", best.has(i) && "font-medium text-accent")}>
                                {c.display}
                                {best.has(i) && <span className="sr-only"> (best)</span>}
                              </div>
                            ))}
                            {models.length < MAX_COMPARE && <div />}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              <p className="mt-4 text-[11.5px] text-ink-3">
                <Tag tone="accent">Highlighted</Tag> = best value in that row (lowest price, highest score or capacity). Ties and rows with fewer than two values are not highlighted.
              </p>
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
