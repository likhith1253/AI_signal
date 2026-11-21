import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getProvider } from "@/server/queries/directory";
import { Container, Stat, Tag } from "@/components/ui/primitives";
import { LabMark } from "@/components/identity/LabMark";
import { ScoreDial } from "@/components/models/bits";
import { cn, fmtPrice, fmtTokens } from "@/lib/format";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProvider(slug);
  return p ? { title: `${p.name} — provider`, description: `${p.offerings.length} models served by ${p.name}, with pricing and availability.` } : { title: "Provider not found" };
}

export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProvider(slug);
  if (!p) notFound();
  return (
    <div>
      <div className="paper-grid border-b border-line">
        <Container className="py-8">
          <Link href="/providers" className="text-[12.5px] text-ink-3 hover:text-ink">
            ← Providers
          </Link>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <LabMark slug={p.slug} name={p.name} size={56} />
              <div>
                <h1 className="font-display text-[34px] leading-tight text-ink">{p.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
                  {p.headquarters && <span>HQ {p.headquarters}</span>}
                  {p.datacenters.length > 0 && <span>· datacenters {p.datacenters.join(", ")}</span>}
                  {p.firstPartyOf && (
                    <Link href={`/labs/${p.firstPartyOf.slug}`}>
                      <Tag tone="accent">First-party API of {p.firstPartyOf.name}</Tag>
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["Website", p.website],
                ["Status", p.statusPageUrl],
                ["Privacy", p.privacyPolicyUrl],
                ["Terms", p.termsUrl],
              ]
                .filter(([, u]) => u)
                .map(([l, u]) => (
                  <a key={l} href={u!} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-surface px-3 text-[12.5px] text-ink-2 hover:text-ink">
                    {l} <ArrowUpRight size={12} />
                  </a>
                ))}
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-5 rounded-lg border border-line bg-surface p-5 sm:grid-cols-4">
            <Stat label="Models served" value={p.stats.offerings} />
            <Stat label="From labs" value={p.stats.labs} />
            <Stat label="Cheapest option for" value={p.stats.cheapestCount} sub="models (input price)" />
            <Stat label="Median uptime" value={p.stats.medianUptime == null ? "—" : `${p.stats.medianUptime.toFixed(1)}%`} sub="last 24h" />
          </div>
        </Container>
      </div>
      <Container className="py-7">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-[22px] text-ink">Catalogue</h2>
          <span className="text-[12px] text-ink-3">“vs cheapest” compares this provider’s input price with the cheapest other active provider of the same model.</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[820px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">In / out / 1M</th>
                <th className="px-3 py-2 font-medium">Cache read</th>
                <th className="px-3 py-2 font-medium">vs cheapest</th>
                <th className="px-3 py-2 font-medium">Context</th>
                <th className="px-3 py-2 font-medium">Quant.</th>
                <th className="px-3 py-2 font-medium">Uptime</th>
                <th className="px-3 py-2 font-medium">Atlas</th>
              </tr>
            </thead>
            <tbody>
              {p.offerings.map((o) => (
                <tr key={o.tag + o.model.slug} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-2">
                    <Link href={`/models/${o.model.slug}`} className="flex items-center gap-2.5">
                      <LabMark slug={o.model.lab.slug} size={22} />
                      <span className="min-w-0">
                        <span className="block max-w-[280px] truncate text-ink hover:underline">{o.model.name}</span>
                        <span className="text-[11px] text-ink-3">{o.model.lab.name}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="num px-3 py-2 text-ink">
                    {fmtPrice(o.input)} / {fmtPrice(o.output)}
                  </td>
                  <td className="num px-3 py-2 text-ink-2">{fmtPrice(o.cacheRead)}</td>
                  <td className="num px-3 py-2">
                    {o.premiumPct == null ? (
                      <span className="text-ink-3">{o.cheapestElsewhere == null && o.input != null ? "only provider" : "—"}</span>
                    ) : (
                      <span className={cn(o.premiumPct <= 0 ? "text-positive" : o.premiumPct > 50 ? "text-negative" : "text-copper")}>
                        {o.premiumPct <= 0 ? (o.premiumPct === 0 ? "matches best" : `${o.premiumPct}% cheaper`) : `+${o.premiumPct}%`}
                      </span>
                    )}
                  </td>
                  <td className="num px-3 py-2 text-ink-2">{fmtTokens(o.contextLength)}</td>
                  <td className="num px-3 py-2 text-ink-2">{o.quantization ?? "—"}</td>
                  <td className="num px-3 py-2 text-ink-2">{o.uptime1d == null ? "—" : `${o.uptime1d.toFixed(1)}%`}</td>
                  <td className="px-3 py-1.5">
                    <ScoreDial score={o.model.score?.overall} confidence={o.model.score?.confidence} size={30} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </div>
  );
}
