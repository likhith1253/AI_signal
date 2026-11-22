import Link from "next/link";
import { ArrowRight, Braces, Brain, Eye, FileText, Layers, PiggyBank, Workflow } from "lucide-react";
import { getOverview } from "@/server/queries/intelligence";
import { listProviders } from "@/server/queries/directory";
import { WORKLOADS } from "@/server/recommend/workloads";
import { Container, LinkArrow, Panel, SectionTitle } from "@/components/ui/primitives";
import { CountUp, Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { HeroSearch } from "@/components/shell/HeroSearch";
import { WelcomeCard } from "@/components/shell/FieldGuide";
import { TopoMap } from "@/components/charts/TopoMap";
import { ChangeFeed } from "@/components/ledger/ChangeFeed";
import { LabMark } from "@/components/identity/LabMark";
import { ScoreDial, TypeTag } from "@/components/models/bits";
import { MiniModelList } from "@/components/models/MiniModelList";
import { fmtDate, fmtPrice, fmtRelative, fmtTokens, TYPE_LABELS } from "@/lib/format";
import { paretoFrontier } from "@/lib/frontier";

export const revalidate = 300;

const WORKLOAD_ICONS: Record<string, typeof Brain> = {
  "software-development": Braces,
  "complex-reasoning": Brain,
  agents: Workflow,
  "document-analysis": FileText,
  vision: Eye,
  "long-context": Layers,
  "cost-sensitive": PiggyBank,
};

function LegendRow({ symbol, children }: { symbol: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-[12.5px] text-ink-2">
      <span className="flex w-8 shrink-0 justify-center">{symbol}</span>
      {children}
    </li>
  );
}

export default async function Home() {
  const [o, providers] = await Promise.all([getOverview(), listProviders()]);
  const frontier = paretoFrontier(o.landscape);
  const maxType = Math.max(...o.byType.map((t) => t.count));
  const pairs = [
    o.featured.length >= 2 && [o.featured[0], o.featured[1]],
    o.featured[0] && o.bestValue[0] && o.featured[0].slug !== o.bestValue[0].slug && [o.featured[0], o.bestValue[0]],
    o.bestValue.length >= 2 && [o.bestValue[0], o.bestValue[1]],
  ].filter(Boolean) as [(typeof o.featured)[number], (typeof o.featured)[number]][];

  return (
    <div>
      <section className="px-4 pt-6 md:px-8">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex items-center gap-3 text-[10.5px] text-ink-3">
            <span className="letter border border-ink px-1.5 py-[1px] text-[11px] font-semibold text-ink">Sheet 01</span>
            <span className="letter">General survey</span>
            <span className="h-px flex-1 bg-line-strong" />
            <span className="num flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping bg-copper opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 bg-copper" />
              </span>
              resurveyed {fmtRelative(o.lastSync)}
            </span>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-end">
            <h1 className="font-display text-[44px] font-bold leading-[0.88] text-ink sm:text-[64px] xl:text-[80px]">
              The terrain of
              <br />
              machine <span className="water font-normal normal-case tracking-normal text-copper">intelligence</span>
            </h1>
            <div>
              <p className="text-[15.5px] leading-relaxed text-ink-2">
                Every model is a station on one sheet, plotted by what it costs and how capable it is. The contours show where the market crowds together, and the red ridge marks the models nothing else beats. Each sync redraws the map and logs what moved.
              </p>
              <div className="mt-4">
                <HeroSearch />
              </div>
            </div>
          </div>
          <div className="mt-5 border-t-[3px] border-double border-ink" />
          <WelcomeCard />
        </div>
      </section>
      <section className="px-4 pt-5 md:px-8">
        <div className="mx-auto grid max-w-[1320px] gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="ticked min-w-0 border border-ink bg-surface-2/40 p-2 md:p-3">
            {/* on phones the sheet keeps its scale and pans sideways, like unfolding a map */}
            <div className="scrollbar-thin overflow-x-auto">
              <div className="min-w-[680px]">
                <TopoMap points={o.landscape} />
              </div>
            </div>
            <p className="water mt-1 text-center text-[11.5px] text-ink-3 md:hidden">Drag sideways to pan the sheet</p>
          </div>
          <aside className="flex flex-col gap-4 text-[12.5px]">
            <Panel title="Legend">
              <ul className="flex flex-col gap-2.5">
                <LegendRow symbol={<svg width="14" height="12"><path d="M7 1 L13 11 H1Z" fill="var(--ink-3)" /></svg>}>Surveyed model (colour = lab)</LegendRow>
                <LegendRow symbol={<svg width="14" height="12"><path d="M7 1 L13 11 H1Z" fill="var(--copper)" /></svg>}>Frontier station</LegendRow>
                <LegendRow symbol={<svg width="30" height="8"><path d="M0 4 H30" stroke="var(--copper)" strokeWidth="2" strokeDasharray="7 4" /></svg>}>Frontier ridge (Pareto)</LegendRow>
                <LegendRow symbol={<svg width="30" height="10"><path d="M0 7 Q8 1 15 5 T30 3" stroke="var(--contour)" fill="none" strokeWidth="1.3" /></svg>}>Contour: density of models</LegendRow>
                <LegendRow symbol={<svg width="26" height="10"><path d="M2 7 h5 M12 3 h5 M19 8 h5" stroke="var(--line-strong)" strokeWidth="1" /></svg>}>Costly shallows</LegendRow>
              </ul>
            </Panel>
            <Panel title="Survey notes">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
                {[
                  ["Stations charted", o.counts.models],
                  ["Benchmarked", o.landscape.length],
                  ["On the ridge", frontier.length],
                  ["Labs", o.counts.labs],
                  ["Providers", o.counts.providers],
                  ["Offerings", o.counts.offerings],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dt className="letter text-[9.5px] text-ink-3">{k}</dt>
                    <dd className="num mt-1 text-[19px] leading-none text-ink">
                      <CountUp value={v as number} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="water mt-3 border-t border-line pt-2 text-[12px] text-ink-3">
                Datum: AA Intelligence Index × log₁₀ blended price. Fixed, so grid references keep their meaning between editions.
              </p>
            </Panel>
          </aside>
        </div>
      </section>

      <Container className="flex flex-col gap-12 py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel title="Field dispatches: observed changes" action={<LinkArrow href="/engine#ledger">Full log</LinkArrow>} flush>
            <ChangeFeed items={o.changes.slice(0, 8)} />
          </Panel>
          <Panel title="Along the ridge, cheapest first" action={<LinkArrow href="/rankings?category=value">Value ranking</LinkArrow>} flush>
            <p className="water border-b border-line px-4 py-2.5 text-[13px] text-ink-2">For every model off this line, one on it is cheaper and at least as capable.</p>
            <ol>
              {frontier.slice(0, 8).map((f, i) => (
                <li key={f.slug} className="border-b border-line last:border-0">
                  <Link href={`/models/${f.slug}`} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2 text-[13px] hover:bg-surface-2">
                    <span className="num text-[10px] text-copper">{String(i + 1).padStart(2, "0")}</span>
                    <span className="truncate text-ink">{f.name}</span>
                    <span className="num text-[11px] text-ink-3">
                      idx {f.intelligence} · {fmtPrice(f.price)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <section>
          <SectionTitle kicker="Highest stations" action={<LinkArrow href="/rankings">All rankings</LinkArrow>}>
            Leading Atlas scores
          </SectionTitle>
          <Stagger className="grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-3">
            {o.featured.map((m, i) => (
              <StaggerItem key={m.slug} className="bg-surface">
                <Link href={`/models/${m.slug}`} className="group flex h-full flex-col p-4 transition-colors hover:bg-surface-2">
                  <div className="flex items-start justify-between gap-3">
                    <span className="num text-[11px] text-ink-3">
                      No.{String(i + 1).padStart(2, "0")} {m.gridRef && <span className="text-copper">· {m.gridRef}</span>}
                    </span>
                    <ScoreDial score={m.score?.overall} confidence={m.score?.confidence} size={52} />
                  </div>
                  <div className="mt-2 text-[17px] font-semibold leading-tight text-ink group-hover:underline group-hover:decoration-copper group-hover:underline-offset-4">{m.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-3">
                    <LabMark slug={m.lab.slug} size={18} /> <span className="water">{m.lab.name}</span>
                  </div>
                  <div className="num mt-4 flex gap-4 border-t border-dashed border-line-strong pt-2.5 text-[11px] text-ink-2">
                    <span>{fmtPrice(m.pricing.blended)}/M</span>
                    <span>{fmtTokens(m.contextLength)} ctx</span>
                    <span>{m.providerCount} prov.</span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <Reveal>
          <SectionTitle kicker="Plan a route" action={<LinkArrow href="/discover">Workload finder</LinkArrow>}>
            Start from the job, not the model name
          </SectionTitle>
          <div className="grid border-l border-t border-line-strong sm:grid-cols-2 lg:grid-cols-4">
            {WORKLOADS.map((w, i) => {
              const I = WORKLOAD_ICONS[w.slug] ?? Brain;
              return (
                <Link key={w.slug} href={`/discover?workload=${w.slug}`} className="group relative flex flex-col gap-2 border-b border-r border-line-strong bg-surface p-4 transition-colors hover:bg-surface-2">
                  <span className="flex items-center justify-between">
                    <I size={18} strokeWidth={1.5} className="text-copper" />
                    <span className="num text-[10px] text-ink-3">R{String(i + 1).padStart(2, "0")}</span>
                  </span>
                  <span className="letter text-[14px] font-semibold text-ink">{w.name}</span>
                  <span className="text-[12.5px] leading-snug text-ink-3">{w.summary}</span>
                  <span className="letter mt-auto pt-1 text-[11px] font-semibold text-copper opacity-0 transition-opacity group-hover:opacity-100">Plot route →</span>
                </Link>
              );
            })}
            <Link href="/compare" className="flex flex-col justify-center gap-1 border-b border-r border-line-strong bg-ink p-4 text-bg hover:opacity-90">
              <span className="font-display text-[20px]">Have a shortlist?</span>
              <span className="flex items-center gap-1 text-[12.5px] opacity-80">
                Compare up to four side by side <ArrowRight size={13} />
              </span>
            </Link>
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Best value" action={<LinkArrow href="/rankings?category=value">More</LinkArrow>} flush>
            <MiniModelList models={o.bestValue} />
            <p className="water border-t border-line px-4 py-2 text-[12px] text-ink-3">Geometric mean of capability percentile and cost efficiency.</p>
          </Panel>
          <Panel title="Newly charted" action={<LinkArrow href="/models?sort=newest">More</LinkArrow>} flush>
            <ul>
              {o.recent.slice(0, 6).map((m) => (
                <li key={m.slug} className="border-b border-line last:border-0">
                  <Link href={`/models/${m.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <LabMark slug={m.lab.slug} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-ink">{m.name}</span>
                      <span className="num block text-[10.5px] text-ink-3">
                        {m.lab.name} · {fmtDate(m.releasedAt)}
                      </span>
                    </span>
                    <TypeTag type={m.type} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="flex flex-col gap-6">
            <Panel title="Land use: models by type">
              <ul className="flex flex-col gap-2">
                {o.byType.map((t) => (
                  <li key={t.type}>
                    <Link href={`/models?type=${t.type}`} className="group grid grid-cols-[88px_1fr_36px] items-center gap-2 text-[12.5px]">
                      <span className="text-ink-2 group-hover:text-ink">{TYPE_LABELS[t.type]}</span>
                      <span className="h-[8px] border border-line-strong">
                        <span className="block h-full bg-accent transition-colors group-hover:bg-copper" style={{ width: `${(t.count / maxType) * 100}%` }} />
                      </span>
                      <span className="num text-right text-ink">{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="num mt-3 flex gap-4 border-t border-line pt-3 text-[11px] text-ink-3">
                <span>
                  <span className="text-ink">{o.counts.openWeights}</span> open weights
                </span>
                <span>
                  <span className="text-ink">{o.counts.free}</span> free tier
                </span>
              </div>
            </Panel>
            <Panel title="Ports of call: largest providers" action={<LinkArrow href="/providers">All</LinkArrow>} flush>
              <ul>
                {providers.slice(0, 5).map((p) => (
                  <li key={p.slug} className="border-b border-line last:border-0">
                    <Link href={`/providers/${p.slug}`} className="flex items-center gap-3 px-4 py-2 hover:bg-surface-2">
                      <LabMark slug={p.slug} size={22} />
                      <span className="flex-1 truncate text-[13px] text-ink">{p.name}</span>
                      <span className="num text-[11px] text-ink-3">{p.offeringCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        {pairs.length > 0 && (
          <Reveal>
            <SectionTitle kicker="Head to head">Comparisons worth running</SectionTitle>
            <div className="grid gap-4 md:grid-cols-3">
              {pairs.map(([a, b]) => (
                <Link key={`${a.slug}-${b.slug}`} href={`/compare?models=${a.slug},${b.slug}`} className="ticked group flex items-center gap-3 border border-line-strong bg-surface p-4 hover:border-ink">
                  <LabMark slug={a.lab.slug} size={30} />
                  <span className="min-w-0 flex-1 text-[13px]">
                    <span className="block truncate font-medium text-ink">{a.name}</span>
                    <span className="water text-ink-3">versus</span> <span className="font-medium text-ink">{b.name}</span>
                  </span>
                  <LabMark slug={b.lab.slug} size={30} />
                  <ArrowRight size={14} className="text-ink-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </Reveal>
        )}
      </Container>
    </div>
  );
}
