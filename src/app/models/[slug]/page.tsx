import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Database, History } from "lucide-react";
import { getModel } from "@/server/queries/models";
import { getLandscape } from "@/server/queries/intelligence";
import { TopoMap } from "@/components/charts/TopoMap";
import { gridRef, regionName } from "@/lib/gridref";
import { Container, Meter, Panel, Stat, Tag } from "@/components/ui/primitives";
import { LabMark } from "@/components/identity/LabMark";
import { CapabilityChip, ModalityStrip, ScoreDial, TypeTag } from "@/components/models/bits";
import { CompareButton } from "@/components/models/CompareButton";
import { ScoreWheel } from "@/components/models/ScoreWheel";
import { ProviderPrices } from "@/components/models/ProviderPrices";
import { CopyId, Expandable } from "@/components/models/Expandable";
import { MiniModelList } from "@/components/models/MiniModelList";
import { COMPONENT_LABELS, fmtDate, fmtPrice, fmtRelative, fmtTokens, UNIT_LABELS } from "@/lib/format";
import { DIMENSION_DESCRIPTIONS } from "@/server/scoring/engine";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const m = await getModel(slug);
  if (!m) return { title: "Model not found" };
  return { title: `${m.name} - ${m.lab.name}`, description: m.description?.slice(0, 160) ?? `${m.name} specifications, pricing and benchmarks.` };
}

const CATEGORY_LABEL: Record<string, string> = { intelligence: "Intelligence", coding: "Coding", agentic: "Agentic", domain: "Domain indices", design: "Design Arena (human preference)" };

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [m, landscape] = await Promise.all([getModel(slug), getLandscape()]);
  if (!m) notFound();
  const intel = m.benchmarks.find((b) => b.slug === "aa-intelligence-index")?.score ?? null;
  const ref = gridRef(m.pricing.blended, intel);
  const region = ref && intel != null && m.pricing.blended ? regionName(m.pricing.blended, intel) : null;

  const active = m.offerings.filter((o) => o.isActive);
  const firstParty = active.find((o) => o.provider.firstParty);
  const byCategory = new Map<string, typeof m.benchmarks>();
  for (const b of m.benchmarks) byCategory.set(b.category, [...(byCategory.get(b.category) ?? []), b]);
  const extraPrices = active.flatMap((o) => o.prices.filter((p) => !["INPUT", "OUTPUT"].includes(p.component) && p.minPromptTokens === 0).map((p) => ({ ...p, provider: o.provider.name })));
  const uniqueExtra = [...new Map(extraPrices.map((p) => [p.component, p])).values()];
  const priceEvents = m.changes.filter((c) => c.kind === "PRICE_CHANGED");

  return (
    <div>
      <div className="paper-grid border-b border-line">
        <Container className="py-7">
          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
            <Link href="/models" className="hover:text-ink">Models</Link>
            <span>/</span>
            <Link href={`/labs/${m.lab.slug}`} className="hover:text-ink">{m.lab.name}</Link>
            {m.family && (
              <>
                <span>/</span>
                <span>{m.family.name}</span>
              </>
            )}
          </div>
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 gap-4">
              <LabMark slug={m.lab.slug} name={m.lab.name} size={56} />
              <div className="min-w-0">
                <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.01em] text-ink md:text-[40px]" data-testid="model-name">{m.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Link href={`/labs/${m.lab.slug}`} className="text-[13.5px] text-ink-2 hover:text-ink">by {m.lab.name}</Link>
                  <TypeTag type={m.type} />
                  {m.status !== "ACTIVE" && <Tag tone="amber">{m.status.toLowerCase()}</Tag>}
                  {m.isOpenWeights && <Tag tone="accent">Open weights</Tag>}
                  {m.pricing.isFree && <Tag tone="positive">Free tier</Tag>}
                  <span className="text-[12.5px] text-ink-3">Released {fmtDate(m.releasedAt)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <CopyId value={m.externalId} />
                  <span className="num text-[11.5px] text-ink-2" data-testid="grid-ref">
                    {ref ? (
                      <>
                        grid ref <span className="text-copper">{ref}</span> · <span className="water text-[13px]">{region}</span>
                      </>
                    ) : (
                      <span className="text-ink-3">unsurveyed: no AA Intelligence Index published</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CompareButton slug={m.slug} name={m.name} lab={m.lab.slug} variant="full" />
              <a href={`https://openrouter.ai/${m.externalId}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-none border border-line bg-surface px-3 text-[13px] text-ink-2 hover:text-ink">
                Source <ArrowUpRight size={13} />
              </a>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 rounded-none border border-line bg-surface p-5 sm:grid-cols-3 lg:grid-cols-7">
            <Stat label="Context" value={fmtTokens(m.contextLength)} sub="tokens" />
            <Stat label="Max output" value={fmtTokens(m.maxOutputTokens)} sub="tokens" />
            <Stat label="Input" value={fmtPrice(m.pricing.input)} sub="cheapest / 1M" />
            <Stat label="Output" value={fmtPrice(m.pricing.output)} sub="cheapest / 1M" />
            <Stat label="Blended" value={fmtPrice(m.pricing.blended)} sub="3:1 / 1M" />
            <Stat label="Providers" value={active.length} sub={firstParty ? `incl. ${firstParty.provider.name}` : "third-party only"} />
            <div className="flex items-center gap-3">
              <ScoreDial score={m.score?.overall} confidence={m.score?.confidence} size={52} />
              <div className="text-[11px] leading-tight text-ink-3">
                Atlas score
                <br />
                {m.score ? `${Math.round(m.score.confidence * 100)}% coverage` : "no data"}
              </div>
            </div>
          </div>
        </Container>
      </div>

      <Container className="grid gap-6 py-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {m.description && (
            <p className="max-w-[760px] text-[15px] leading-relaxed text-ink-2">{m.description}</p>
          )}
          {m.score && (
            <Panel
              id="score"
              title="Why this score - Atlas Intelligence Score trace"
              action={
                <Link href="/methodology" className="text-[12px] text-accent hover:underline">
                  Methodology {m.score.methodology}
                </Link>
              }
            >
              <div className="grid gap-6 2xl:grid-cols-[260px_minmax(0,1fr)]">
                <div className="flex flex-col items-center 2xl:items-center">
                  <ScoreWheel dims={m.score.traces.map((t) => ({ key: t.key, label: t.label, score: t.score }))} overall={m.score.overall} />
                  <p className="mt-2 max-w-[250px] text-center text-[11.5px] leading-snug text-ink-3">
                    {m.score.overall == null
                      ? `Only ${Math.round(m.score.confidence * 100)}% of the weight has data (60% required), so no overall score is published.`
                      : `${Math.round(m.score.confidence * 100)}% of the weight is backed by data. Missing dimensions are excluded, not zeroed.`}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-[12.5px]" data-testid="score-trace">
                    <thead>
                      <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                        <th className="py-2 pr-3 font-medium">Dimension</th>
                        <th className="py-2 pr-3 font-medium">Input</th>
                        <th className="w-[22%] py-2 pr-3 font-medium">Score</th>
                        <th className="py-2 pr-3 text-right font-medium">Weight</th>
                        <th className="py-2 text-right font-medium">Adds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.score.traces.map((t) => {
                        const c = m.score!.contributions.find((x) => x.key === t.key);
                        return (
                          <tr key={t.key} className="border-b border-line align-top last:border-0">
                            <td className="py-2 pr-3 text-ink" title={DIMENSION_DESCRIPTIONS[t.key]}>
                              {t.label}
                            </td>
                            <td className="py-2 pr-3">
                              <div className="text-ink-2">{t.raw}</div>
                              <div className="text-[11px] text-ink-3">{t.method}</div>
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <Meter value={t.score} />
                                <span className="num w-8 text-right text-ink">{t.score == null ? "—" : t.score.toFixed(0)}</span>
                              </div>
                            </td>
                            <td className="num py-2 pr-3 text-right text-ink-3">{c ? `${Math.round(c.weight * 100)}%` : "—"}</td>
                            <td className="num py-2 text-right text-ink">{c && t.score != null ? `+${c.contribution.toFixed(1)}` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11.5px] text-ink-3">
                    Overall = Σ(score × weight) ÷ Σ(weights with data). A composite of published data - not an independent evaluation.
                  </p>
                </div>
              </div>
            </Panel>
          )}
          <Panel id="providers" title={`Provider availability · ${active.length} active endpoint${active.length === 1 ? "" : "s"}`}>
            {m.offerings.length ? <ProviderPrices offerings={m.offerings} /> : <p className="text-[13px] text-ink-3">This is an alias; it has no endpoints of its own.</p>}
            {uniqueExtra.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <div className="mb-2 text-[10.5px] uppercase tracking-[0.08em] text-ink-3">Other priced components (base tier)</div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {uniqueExtra.map((p) => (
                    <div key={p.component} className="text-[12.5px]">
                      <span className="text-ink-3">{COMPONENT_LABELS[p.component]}</span>{" "}
                      <span className="num text-ink">
                        {p.isVariable ? "Variable" : fmtPrice(p.amount)}
                        <span className="text-ink-3"> {UNIT_LABELS[p.unit]}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
          <Panel id="benchmarks" title={`Benchmarks · ${m.benchmarks.length} published results`}>
            {m.benchmarks.length === 0 ? (
              <p className="text-[13px] text-ink-3">No independent benchmark results are published for this model yet. Its Atlas score therefore omits the capability dimensions.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {[...byCategory.entries()].map(([cat, list]) => (
                  <div key={cat}>
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-ink-3">
                      {CATEGORY_LABEL[cat] ?? cat}
                      <Tag tone="accent">External</Tag>
                    </div>
                    <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                      {list.map((b) => (
                        <div key={b.slug}>
                          <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                            <Link href={`/rankings?category=${cat === "design" ? "design" : cat === "domain" ? "overall" : cat}${cat === "design" || cat === "domain" ? `&benchmark=${b.slug}` : ""}`} className="truncate text-ink-2 hover:text-ink">
                              {b.name.replace("Design Arena · ", "")}
                            </Link>
                            <span className="num text-ink">
                              {b.scaleLabel === "Elo rating" ? Math.round(b.score) : b.score.toFixed(1)}
                              {b.sourceRank != null && <span className="ml-1.5 text-[11px] text-ink-3">#{b.sourceRank}</span>}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Meter value={b.percentile == null ? null : b.percentile * 100} tone="copper" height={4} />
                            <span className="num w-[52px] shrink-0 text-right text-[10.5px] text-ink-3">p{b.percentile == null ? "—" : Math.round(b.percentile * 100)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-[11.5px] text-ink-3">
                  Bars show percentile within each benchmark so different scales (index vs Elo) are never compared directly. Source:{" "}
                  {[...new Set(m.benchmarks.map((b) => b.source.name))].join(", ")} via the OpenRouter catalogue, observed {fmtDate(m.benchmarks[0].observedAt)}.
                </p>
              </div>
            )}
          </Panel>
          <Panel id="history" title="Evolution - observed changes">
            {m.changes.length === 0 ? (
              <div className="flex items-start gap-3 text-[13px] text-ink-2">
                <History size={16} className="mt-0.5 text-ink-3" />
                <div>
                  No changes observed since OneAtlas started tracking this model on {fmtDate(m.firstSeenAt)}. Every ingest run diffs the catalogue; price, context and availability changes will appear here as they happen.
                </div>
              </div>
            ) : (
              <ol className="relative ml-1.5 border-l border-line pl-5">
                {m.changes.map((c, i) => (
                  <li key={i} className="relative pb-3 last:pb-0">
                    <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full border border-copper bg-surface" />
                    <div className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                      <span className="text-ink">{c.kind.replace(/_/g, " ").toLowerCase()}</span>
                      {c.field && <span className="num text-[11.5px] text-ink-3">{c.field}</span>}
                      {(c.before != null || c.after != null) && (
                        <span className="num text-ink-2">
                          {JSON.stringify(c.before)} → <span className="text-ink">{JSON.stringify(c.after)}</span>
                        </span>
                      )}
                      <span className="text-[11.5px] text-ink-3">{fmtRelative(c.at)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {priceEvents.length > 0 && <p className="mt-3 text-[11.5px] text-ink-3">Prices in USD per 1M tokens. Changes are recorded by the Atlas Engine diff stage, never back-filled.</p>}
          </Panel>
        </div>
        <aside className="flex flex-col gap-6">
          <Panel title={ref ? `Locator · ${ref}` : "Locator"} flush>
            {ref ? (
              <div className="p-2">
                <TopoMap points={landscape} compact highlight={m.slug} />
              </div>
            ) : (
              <p className="p-4 text-[12.5px] text-ink-3">
                Not on the map yet. A station needs a published AA Intelligence Index and a known price to be placed on the datum.
              </p>
            )}
            {ref && <p className="water border-t border-line px-4 py-2 text-[12px] text-ink-3">Ringed: this model, among {landscape.length} surveyed stations.</p>}
          </Panel>
          <Panel title="Model specification">
            <dl className="flex flex-col gap-3 text-[12.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-3">Modalities</dt>
                <dd>
                  <ModalityStrip input={m.inputModalities} output={m.outputModalities} />
                </dd>
              </div>
              {[
                ["Input", m.inputModalities.join(", ") || "—"],
                ["Output", m.outputModalities.join(", ") || "—"],
                ["Context window", m.contextLength ? `${m.contextLength.toLocaleString("en-US")} tokens` : "—"],
                ["Max output", m.maxOutputTokens ? `${m.maxOutputTokens.toLocaleString("en-US")} tokens` : "—"],
                ["Tokenizer", m.tokenizer ?? "—"],
                ["Knowledge cutoff", m.knowledgeCutoff ?? "Not published"],
                ["Reasoning", m.reasoningMandatory ? "Always on" : m.capabilities.some((c) => c.slug === "reasoning") ? "Optional" : "No"],
                ["Family", m.family?.name ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right text-ink">{v}</dd>
                </div>
              ))}
              {m.huggingFaceId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Weights</dt>
                  <dd>
                    <a href={`https://huggingface.co/${m.huggingFaceId}`} target="_blank" rel="noreferrer" className="num text-[11.5px] text-accent hover:underline">
                      {m.huggingFaceId}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-3">Model-level values. Individual providers may cap context or output lower - see provider availability.</p>
          </Panel>

          <Panel title="Capabilities">
            {m.capabilities.length ? (
              <div className="flex flex-wrap gap-1.5">
                {m.capabilities.map((c) => (
                  <span key={c.slug} title={`Evidence: ${c.evidence}`}>
                    <CapabilityChip slug={c.slug} />
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-ink-3">No capabilities declared.</p>
            )}
            {m.supportedParams.length > 0 && (
              <div className="mt-3 border-t border-line pt-2">
                <Expandable label={<span>{m.supportedParams.length} supported API parameters</span>}>
                  <div className="flex flex-wrap gap-1">
                    {m.supportedParams.map((p) => (
                      <span key={p} className="num rounded-none bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">
                        {p}
                      </span>
                    ))}
                  </div>
                </Expandable>
              </div>
            )}
          </Panel>

          <Panel title="Provenance">
            <div className="flex flex-col gap-2 text-[12.5px]">
              <div className="flex items-start gap-2">
                <Database size={14} className="mt-0.5 text-ink-3" />
                <div>
                  <a href={m.source.url} target="_blank" rel="noreferrer" className="text-ink hover:underline">
                    {m.source.name}
                  </a>
                  <div className="text-[11.5px] text-ink-3">Registry, specs, offerings and prices</div>
                </div>
              </div>
              {[
                ["First tracked", fmtDate(m.firstSeenAt)],
                ["Last synced", fmtRelative(m.lastSyncedAt)],
                ["Score computed", m.score ? fmtRelative(m.score.computedAt) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-ink-3">{k}</span>
                  <span className="text-ink">{v}</span>
                </div>
              ))}
              <Link href="/engine" className="mt-1 text-[12px] text-accent hover:underline">
                See ingestion runs →
              </Link>
            </div>
          </Panel>

          {m.family && m.family.models.length > 1 && (
            <Panel title={`${m.family.name} family`} flush>
              <MiniModelList models={m.family.models.filter((x) => x.slug !== m.slug)} />
            </Panel>
          )}
          {m.related.length > 0 && (
            <Panel title="Similar Atlas score, other families" flush>
              <MiniModelList models={m.related} />
            </Panel>
          )}
        </aside>
      </Container>
    </div>
  );
}
