import Link from "next/link";
import { ArrowRight, Braces, Brain, Eye, FileText, Layers, PiggyBank, Workflow } from "lucide-react";
import { getOverview } from "@/server/queries/intelligence";
import { listProviders } from "@/server/queries/directory";
import { WORKLOADS } from "@/server/recommend/workloads";
import { Container, LinkArrow, Panel, SectionTitle } from "@/components/ui/primitives";
import { CountUp, Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { HeroSearch } from "@/components/shell/HeroSearch";
import { FrontierChart } from "@/components/charts/FrontierChart";
import { ChangeFeed } from "@/components/ledger/ChangeFeed";
import { LabMark } from "@/components/identity/LabMark";
import { CapabilityIcons, ScoreDial, TypeTag } from "@/components/models/bits";
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
      {/* ── hero ── */}
      <section className="paper-grid relative border-b border-line">
        <Container className="grid gap-8 py-10 md:py-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-[4px] border border-line bg-surface px-2 py-1 text-[11.5px] text-ink-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
              </span>
              Catalogue synced {fmtRelative(o.lastSync)} from live sources
            </div>
            <h1 className="max-w-[640px] font-display text-[38px] leading-[1.04] tracking-[-0.015em] text-ink md:text-[54px]">
              The intelligence layer for the <em className="text-accent">AI model</em> ecosystem.
            </h1>
            <p className="mt-4 max-w-[560px] text-[15.5px] leading-relaxed text-ink-2">
              One normalized registry of models, the providers that serve them and what they really cost — scored with a transparent, traceable method and diffed every sync so you can see the market move.
            </p>
            <div className="mt-6">
              <HeroSearch />
            </div>
            <dl className="mt-8 grid max-w-[640px] grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-5">
              {[
                ["Models", o.counts.models],
                ["Labs", o.counts.labs],
                ["Providers", o.counts.providers],
                ["Offerings", o.counts.offerings],
                ["Benchmarks", o.counts.results],
              ].map(([k, v]) => (
                <div key={k as string} className="border-l border-line pl-3">
                  <dt className="text-[10.5px] uppercase tracking-[0.09em] text-ink-3">{k}</dt>
                  <dd className="num mt-1 text-[21px] leading-none text-ink">
                    <CountUp value={v as number} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <Panel
            className="self-start shadow-[var(--shadow)]"
            title={
              <span className="flex items-center gap-2">
                Change ledger <span className="hidden text-[11px] font-normal text-ink-3 xl:inline">what moved, as observed</span>
              </span>
            }
            action={<LinkArrow href="/engine#ledger">All changes</LinkArrow>}
            flush
          >
            <ChangeFeed items={o.changes.slice(0, 7)} />
          </Panel>
        </Container>
      </section>

      <Container className="flex flex-col gap-12 py-10">
        {/* ── frontier ── */}
        <Reveal>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <SectionTitle kicker="Cost-to-capability" action={<LinkArrow href="/rankings?category=value">Value ranking</LinkArrow>}>
                Who you can afford at each level of intelligence
              </SectionTitle>
              <div className="rounded-lg border border-line bg-surface p-4">
                <FrontierChart points={o.landscape} />
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:pt-[52px]">
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                {o.landscape.length} models have both a published Artificial Analysis Intelligence Index and a known price. Only <span className="text-ink">{frontier.length}</span> sit on the frontier: for every other model, something on this line is cheaper and at least as capable.
              </p>
              <div className="rounded-lg border border-line bg-surface">
                <div className="border-b border-line px-4 py-2 text-[10.5px] uppercase tracking-[0.08em] text-ink-3">Frontier, cheapest first</div>
                <ul>
                  {frontier.slice(0, 7).map((f) => (
                    <li key={f.slug} className="border-b border-line last:border-0">
                      <Link href={`/models/${f.slug}`} className="flex items-center justify-between gap-2 px-4 py-2 text-[12.5px] hover:bg-surface-2">
                        <span className="truncate text-ink">{f.name}</span>
                        <span className="num shrink-0 text-ink-3">
                          {f.intelligence} · {fmtPrice(f.price)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ── featured ── */}
        <section>
          <SectionTitle kicker="Highest Atlas score" action={<LinkArrow href="/rankings">Full rankings</LinkArrow>}>
            Leading models right now
          </SectionTitle>
          <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {o.featured.map((m, i) => (
              <StaggerItem key={m.slug}>
                <Link href={`/models/${m.slug}`} className="group relative flex h-full gap-4 rounded-lg border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]">
                  <span className="num absolute right-4 top-3 text-[11px] text-ink-3">#{i + 1}</span>
                  <ScoreDial score={m.score?.overall} confidence={m.score?.confidence} size={50} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
                      <LabMark slug={m.lab.slug} size={16} /> {m.lab.name}
                    </div>
                    <div className="mt-1 truncate text-[15px] font-medium text-ink">{m.name}</div>
                    <div className="num mt-2 flex gap-3 text-[11.5px] text-ink-2">
                      <span>{fmtPrice(m.pricing.blended)}/M</span>
                      <span>{fmtTokens(m.contextLength)} ctx</span>
                      <span>{m.providerCount} prov.</span>
                    </div>
                    <CapabilityIcons caps={m.capabilities} max={5} className="mt-2.5" />
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* ── workloads ── */}
        <Reveal>
          <SectionTitle kicker="Workload finder" action={<LinkArrow href="/discover">Open finder</LinkArrow>}>
            Start from the job, not the model name
          </SectionTitle>
          <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {WORKLOADS.map((w) => {
              const I = WORKLOAD_ICONS[w.slug] ?? Brain;
              return (
                <Link key={w.slug} href={`/discover?workload=${w.slug}`} className="group flex flex-col gap-2 bg-surface p-4 transition-colors hover:bg-surface-2">
                  <I size={17} strokeWidth={1.6} className="text-copper" />
                  <span className="text-[14px] font-medium text-ink">{w.name}</span>
                  <span className="text-[12.5px] leading-snug text-ink-3">{w.summary}</span>
                  <span className="mt-auto pt-1 text-[12px] text-accent opacity-0 transition-opacity group-hover:opacity-100">See picks →</span>
                </Link>
              );
            })}
            <Link href="/compare" className="flex flex-col justify-center gap-1 bg-surface-2 p-4 hover:bg-surface-3">
              <span className="font-display text-[18px] text-ink">Already have a shortlist?</span>
              <span className="flex items-center gap-1 text-[12.5px] text-ink-2">
                Compare up to four models <ArrowRight size={13} />
              </span>
            </Link>
          </div>
        </Reveal>

        {/* ── three columns ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Best value" action={<LinkArrow href="/rankings?category=value">More</LinkArrow>} flush>
            <MiniModelList models={o.bestValue} />
            <p className="border-t border-line px-4 py-2 text-[11px] text-ink-3">Geometric mean of capability percentile and cost efficiency.</p>
          </Panel>
          <Panel title="Recently released" action={<LinkArrow href="/models?sort=newest">More</LinkArrow>} flush>
            <ul>
              {o.recent.slice(0, 6).map((m) => (
                <li key={m.slug} className="border-b border-line last:border-0">
                  <Link href={`/models/${m.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <LabMark slug={m.lab.slug} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{m.name}</span>
                      <span className="block text-[11px] text-ink-3">
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
            <Panel title="Ecosystem by model type">
              <ul className="flex flex-col gap-2">
                {o.byType.map((t) => (
                  <li key={t.type}>
                    <Link href={`/models?type=${t.type}`} className="group grid grid-cols-[88px_1fr_36px] items-center gap-2 text-[12.5px]">
                      <span className="text-ink-2 group-hover:text-ink">{TYPE_LABELS[t.type]}</span>
                      <span className="h-[7px] overflow-hidden rounded-[2px] bg-surface-3">
                        <span className="block h-full rounded-[2px] bg-accent transition-all group-hover:bg-copper" style={{ width: `${(t.count / maxType) * 100}%` }} />
                      </span>
                      <span className="num text-right text-ink">{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-4 border-t border-line pt-3 text-[12px] text-ink-3">
                <span>
                  <span className="num text-ink">{o.counts.openWeights}</span> open weights
                </span>
                <span>
                  <span className="num text-ink">{o.counts.free}</span> with free tier
                </span>
              </div>
            </Panel>
            <Panel title="Largest providers" action={<LinkArrow href="/providers">All</LinkArrow>} flush>
              <ul>
                {providers.slice(0, 5).map((p) => (
                  <li key={p.slug} className="border-b border-line last:border-0">
                    <Link href={`/providers/${p.slug}`} className="flex items-center gap-3 px-4 py-2 hover:bg-surface-2">
                      <LabMark slug={p.slug} size={22} />
                      <span className="flex-1 truncate text-[13px] text-ink">{p.name}</span>
                      <span className="num text-[11.5px] text-ink-3">{p.offeringCount} models</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        {/* ── popular comparisons ── */}
        {pairs.length > 0 && (
          <Reveal>
            <SectionTitle kicker="Head to head">Comparisons worth running</SectionTitle>
            <div className="grid gap-3 md:grid-cols-3">
              {pairs.map(([a, b]) => (
                <Link key={`${a.slug}-${b.slug}`} href={`/compare?models=${a.slug},${b.slug}`} className="group flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
                  <LabMark slug={a.lab.slug} size={28} />
                  <span className="min-w-0 flex-1 text-[13px]">
                    <span className="block truncate text-ink">{a.name}</span>
                    <span className="text-ink-3">vs</span> <span className="text-ink">{b.name}</span>
                  </span>
                  <LabMark slug={b.lab.slug} size={28} />
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
