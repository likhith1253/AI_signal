import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getLab } from "@/server/queries/directory";
import { Container, Panel, Stat, Tag } from "@/components/ui/primitives";
import { LabMark } from "@/components/identity/LabMark";
import { ReleaseTimeline } from "@/components/charts/ReleaseTimeline";
import { CapabilityIcons, PriceCell, ScoreDial, TypeTag } from "@/components/models/bits";
import { fmtDate, fmtTokens } from "@/lib/format";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lab = await getLab(slug);
  return lab ? { title: lab.name, description: lab.description ?? undefined } : { title: "Lab not found" };
}

export default async function LabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lab = await getLab(slug);
  if (!lab) notFound();
  const scored = lab.models.filter((m) => m.score?.overall != null);
  const families = lab.families.sort((a, b) => b.modelCount - a.modelCount);

  return (
    <div>
      <div className="paper-grid border-b border-line">
        <Container className="py-8">
          <Link href="/labs" className="text-[12.5px] text-ink-3 hover:text-ink">
            ← AI labs
          </Link>
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <LabMark slug={lab.slug} name={lab.name} size={60} />
              <div>
                <h1 className="font-display text-[36px] leading-tight text-ink">{lab.name}</h1>
                <div className="mt-1 text-[13px] text-ink-3">{[lab.headquarters, lab.foundedYear && `Founded ${lab.foundedYear}`].filter(Boolean).join(" · ")}</div>
                {lab.description && <p className="mt-3 max-w-[640px] text-[14.5px] leading-relaxed text-ink-2">{lab.description}</p>}
                {!lab.isCurated && <p className="mt-2 text-[12px] text-ink-3">Profile inferred from catalogue identifiers - not curated.</p>}
              </div>
            </div>
            {lab.website && (
              <a href={lab.website} target="_blank" rel="noreferrer" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-none border border-line bg-surface px-3 text-[13px] text-ink-2 hover:text-ink">
                Website <ArrowUpRight size={13} />
              </a>
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-5 rounded-none border border-line bg-surface p-5 sm:grid-cols-4">
            <Stat label="Models" value={lab.models.length} />
            <Stat label="Families" value={families.length} />
            <Stat label="Served by" value={lab.servedBy.length} sub="providers" />
            <Stat label="Top Atlas score" value={scored.length ? Math.max(...scored.map((m) => m.score!.overall!)).toFixed(1) : "—"} />
          </div>
        </Container>
      </div>

      <Container className="grid gap-6 py-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Release timeline">
            <ReleaseTimeline models={lab.models.map((m) => ({ slug: m.slug, name: m.name, releasedAt: m.releasedAt, family: m.family?.name ?? "Other", score: m.score?.overall ?? null }))} />
          </Panel>
          <Panel title={`Models · ${lab.models.length}`} flush>
            <ul>
              {lab.models.map((m) => (
                <li key={m.slug} className="border-b border-line last:border-0">
                  <Link href={`/models/${m.slug}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_110px_120px_70px_40px]">
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] text-ink">{m.name}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-3">
                        {fmtDate(m.releasedAt)} <CapabilityIcons caps={m.capabilities} max={4} />
                      </span>
                    </span>
                    <span className="hidden md:block">
                      <TypeTag type={m.type} />
                    </span>
                    <span className="hidden md:block">
                      <PriceCell {...m.pricing} />
                    </span>
                    <span className="num hidden text-[12.5px] text-ink-2 md:block">{fmtTokens(m.contextLength)}</span>
                    <ScoreDial score={m.score?.overall} confidence={m.score?.confidence} size={32} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <aside className="flex flex-col gap-6">
          <Panel title="Model families">
            {families.length ? (
              <ul className="flex flex-col gap-1.5">
                {families.map((f) => (
                  <li key={f.slug} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink">{f.name}</span>
                    <span className="num text-ink-3">{f.modelCount}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-ink-3">No families identified.</p>
            )}
          </Panel>
          <Panel title="Where to run these models" flush>
            <ul>
              {lab.servedBy.slice(0, 12).map((p) => (
                <li key={p.slug} className="border-b border-line last:border-0">
                  <Link href={`/providers/${p.slug}`} className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-2">
                    <LabMark slug={p.slug} size={22} />
                    <span className="flex-1 truncate text-[13px] text-ink">{p.name}</span>
                    {lab.firstPartyProviders.some((f) => f.slug === p.slug) && <Tag tone="accent">First-party</Tag>}
                    <span className="num text-[11.5px] text-ink-3">{p.offerings}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </Container>
    </div>
  );
}
