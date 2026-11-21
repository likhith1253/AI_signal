import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_WEIGHTS, DIMENSION_DESCRIPTIONS, DIMENSION_LABELS, METHODOLOGY, MIN_CONFIDENCE, type DimensionKey } from "@/server/scoring/engine";
import { WORKLOADS } from "@/server/recommend/workloads";
import { Container, PageHeader, Panel, Tag } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Methodology", description: "How the Atlas Intelligence Score, pricing normalization and recommendations are calculated." };

export default function MethodologyPage() {
  const dims = Object.keys(DEFAULT_WEIGHTS) as DimensionKey[];
  return (
    <>
      <PageHeader sheet="11" eyebrow={`Methodology · ${METHODOLOGY}`} title="How OneAtlas scores and normalizes" description="Every number OneAtlas computes can be traced back to published inputs. This page is generated from the same constants the scoring code uses, so it cannot drift from the implementation." />
      <Container className="grid gap-6 py-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <Panel title="Atlas Intelligence Score — dimensions and default weights">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                    <th className="py-2 pr-3 font-medium">Dimension</th>
                    <th className="py-2 pr-3 font-medium">How it is computed</th>
                    <th className="py-2 text-right font-medium">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {dims.map((d) => (
                    <tr key={d} className="border-b border-line align-top last:border-0">
                      <td className="py-2.5 pr-3 text-ink">{DIMENSION_LABELS[d]}</td>
                      <td className="py-2.5 pr-3 text-ink-2">{DIMENSION_DESCRIPTIONS[d]}</td>
                      <td className="num py-2.5 text-right text-ink">{Math.round(DEFAULT_WEIGHTS[d] * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Combining dimensions">
            <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-ink-2">
              <p>
                <code className="num rounded bg-surface-2 px-1.5 py-0.5 text-ink">overall = Σ(scoreᵢ × weightᵢ) ÷ Σ(weightᵢ for dimensions with data)</code>
              </p>
              <p>
                Missing dimensions are <strong className="text-ink">excluded, not zeroed</strong>. The share of weight that had data is published as <em>coverage</em>. An overall score is only shown when coverage is at least <span className="num text-ink">{Math.round(MIN_CONFIDENCE * 100)}%</span>; because benchmark dimensions carry 45% of the default weight, a model with no benchmark signal never gets an overall score — its price and context alone cannot make it look &ldquo;intelligent&rdquo;.
              </p>
              <p>Benchmark dimensions use percentiles within the catalogue, so a 0–100 index and an Elo rating are never added together. Cost uses a log scale between the 5th and 95th percentile of blended prices, so a 10× price difference matters equally at any price level.</p>
              <p>
                Custom weightings on the <Link href="/rankings" className="text-accent hover:underline">rankings page</Link> recompute the composite from the stored dimension scores at request time; the stored defaults are recomputed by the engine&apos;s derive stage after every sync.
              </p>
            </div>
          </Panel>

          <Panel title="Pricing normalization">
            <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink-2">
              <li>Source prices (USD per token) are converted to USD per 1M tokens and stored as exact decimals (Postgres <code className="num">numeric(18,6)</code>).</li>
              <li>
                Three states are kept distinct: <Tag tone="outline">no row</Tag> = not published / unknown, <Tag tone="positive">0</Tag> = genuinely free, <Tag tone="amber">variable</Tag> = the source reports a dynamic price (routers). Unknown is never treated as zero in sorting, filtering or scoring.
              </li>
              <li>Pricing is per offering (model × provider). A model&apos;s headline price is its cheapest active offering; blended price = (3 × input + output) ÷ 4.</li>
              <li>Long-context tiers (higher price above a prompt-length threshold) are stored as separate tiers. Time-of-day discount windows are ignored and the base price is kept.</li>
              <li>Cache read/write, reasoning, image, audio, web-search and per-request prices are stored as their own components with their own units.</li>
            </ul>
          </Panel>

          <Panel title="Workload recommendations">
            <p className="mb-3 text-[13.5px] text-ink-2">Each workload is a declarative profile: hard requirements filter the candidates, then a workload-specific weight vector ranks them. The final fit is confidence-adjusted: <code className="num rounded bg-surface-2 px-1">fit = score × (0.75 + 0.25 × coverage)</code>, so a model with complete data beats an equal score with gaps. No LLM is involved; results are reproducible.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {WORKLOADS.map((w) => (
                <div key={w.slug} className="rounded-none border border-line p-3">
                  <Link href={`/discover?workload=${w.slug}`} className="text-[13px] font-medium text-ink hover:underline">
                    {w.name}
                  </Link>
                  <div className="num mt-1 text-[11px] text-ink-3">
                    {Object.entries(w.weights)
                      .map(([k, v]) => `${k} ${Math.round((v ?? 0) * 100)}%`)
                      .join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="What the score is not">
            <ul className="list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-ink-2">
              <li>Not an independent evaluation. It re-weights published benchmarks, prices and specifications.</li>
              <li>Not comparable across methodology versions. The version is stored with every score.</li>
              <li>Only as complete as its inputs: many models have no published benchmarks and are labelled accordingly.</li>
            </ul>
          </Panel>
          <Panel title="Sources">
            <ul className="space-y-2 text-[12.5px]">
              <li>
                <a href="https://openrouter.ai/docs/api-reference/overview" className="text-accent hover:underline" target="_blank" rel="noreferrer">
                  OpenRouter API
                </a>
                <div className="text-ink-3">Models, endpoints, pricing, providers</div>
              </li>
              <li>
                <a href="https://artificialanalysis.ai/methodology" className="text-accent hover:underline" target="_blank" rel="noreferrer">
                  Artificial Analysis
                </a>
                <div className="text-ink-3">Intelligence, coding, agentic and domain indices</div>
              </li>
              <li>
                <a href="https://www.designarena.ai" className="text-accent hover:underline" target="_blank" rel="noreferrer">
                  Design Arena
                </a>
                <div className="text-ink-3">Human-preference Elo for design and code generation</div>
              </li>
            </ul>
            <Link href="/engine" className="mt-3 inline-block text-[12.5px] text-accent hover:underline">
              Freshness and ingestion runs →
            </Link>
          </Panel>
        </aside>
      </Container>
    </>
  );
}
