import type { Metadata } from "next";
import Link from "next/link";
import { listProviders } from "@/server/queries/directory";
import { Container, PageHeader, Tag } from "@/components/ui/primitives";
import { LabMark } from "@/components/identity/LabMark";
import { fmtPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Providers", description: "API providers serving models, with catalogue size, pricing and reliability." };
export const revalidate = 600;

export default async function ProvidersPage() {
  const providers = await listProviders();
  const max = Math.max(...providers.map((p) => p.offeringCount));
  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Providers"
        description={`${providers.length} inference providers currently serving at least one model. A provider hosts models — often from many labs — at its own price, quantization and limits.`}
      />
      <Container className="py-6">
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[760px] text-left text-[12.5px]" data-testid="providers-table">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="w-[26%] px-3 py-2 font-medium">Models served</th>
                <th className="px-3 py-2 font-medium">Labs</th>
                <th className="px-3 py-2 font-medium">Median input / 1M</th>
                <th className="px-3 py-2 font-medium">Median uptime</th>
                <th className="px-3 py-2 font-medium">Region</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.slug} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <Link href={`/providers/${p.slug}`} className="flex items-center gap-2.5">
                      <LabMark slug={p.slug} size={26} />
                      <span>
                        <span className="block text-[13.5px] text-ink hover:underline">{p.name}</span>
                        {p.firstPartyOf && <span className="text-[11px] text-ink-3">First-party API of {p.firstPartyOf.name}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-[6px] flex-1 overflow-hidden rounded-[2px] bg-surface-3">
                        <span className="block h-full rounded-[2px] bg-accent" style={{ width: `${(p.offeringCount / max) * 100}%` }} />
                      </span>
                      <span className="num w-8 text-right text-ink">{p.offeringCount}</span>
                    </div>
                  </td>
                  <td className="num px-3 py-2.5 text-ink-2">{p.labCount}</td>
                  <td className="num px-3 py-2.5 text-ink-2">{fmtPrice(p.medianInputPrice)}</td>
                  <td className="num px-3 py-2.5 text-ink-2">{p.medianUptime == null ? "—" : `${p.medianUptime.toFixed(1)}%`}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {p.headquarters ? <Tag tone="outline">{p.headquarters}</Tag> : <span className="text-ink-3">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11.5px] text-ink-3">Provider metadata from the OpenRouter provider directory. Uptime is the last-24h figure reported per endpoint.</p>
      </Container>
    </>
  );
}
