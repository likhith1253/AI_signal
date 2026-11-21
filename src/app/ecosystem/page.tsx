import type { Metadata } from "next";
import Link from "next/link";
import { getEcosystem } from "@/server/queries/intelligence";
import { Container, PageHeader, Panel } from "@/components/ui/primitives";
import { LabMark } from "@/components/identity/LabMark";
import { capabilityLabel } from "@/components/models/bits";

export const metadata: Metadata = { title: "Ecosystem", description: "Relationships between labs, providers and capabilities across the model ecosystem." };
export const revalidate = 600;

export default async function EcosystemPage() {
  const e = await getEcosystem();
  const max = Math.max(...e.matrix.flat().map((c) => c.n), 1);
  return (
    <>
      <PageHeader sheet="07"
        eyebrow="Ecosystem explorer"
        title="Who builds, who serves"
        description={`${e.totals.pairs} lab–provider relationships across ${e.totals.labs} labs and ${e.totals.providers} providers. Labs train models; providers decide where, how fast and at what price you can run them.`}
      />
      <Container className="flex flex-col gap-8 py-6">
        <Panel title="Distribution matrix — number of a lab's models each provider serves" flush>
          <div className="overflow-x-auto p-4">
            <table className="border-separate border-spacing-[3px] text-[11px]" data-testid="ecosystem-matrix">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface" />
                  {e.providers.map((p) => (
                    <th key={p.slug} className="h-[110px] w-[34px] align-bottom font-normal">
                      <Link href={`/providers/${p.slug}`} className="inline-block w-[34px] whitespace-nowrap text-left text-ink-2 hover:text-ink" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                        {p.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {e.labs.map((l, li) => (
                  <tr key={l.slug}>
                    <th className="sticky left-0 z-10 bg-surface pr-2 text-left font-normal">
                      <Link href={`/labs/${l.slug}`} className="flex items-center gap-2 whitespace-nowrap text-[12px] text-ink hover:underline">
                        <LabMark slug={l.slug} size={20} />
                        {l.name}
                        <span className="num text-[10.5px] text-ink-3">{l.models}</span>
                      </Link>
                    </th>
                    {e.matrix[li].map((c, pi) => (
                      <td key={pi} className="p-0">
                        <div
                          className="num flex h-[30px] w-[34px] items-center justify-center rounded-none text-[10.5px]"
                          style={{
                            background: c.n ? `color-mix(in oklab, var(--accent) ${Math.round(12 + (c.n / max) * 78)}%, var(--surface))` : "var(--surface-2)",
                            color: c.n / max > 0.45 ? "var(--accent-ink)" : "var(--ink-2)",
                            outline: c.firstParty ? "1.5px solid var(--copper)" : undefined,
                            outlineOffset: c.firstParty ? "-1.5px" : undefined,
                          }}
                          title={`${l.name} × ${e.providers[pi].name}: ${c.n} model${c.n === 1 ? "" : "s"}${c.firstParty ? " (first-party)" : ""}`}
                        >
                          {c.n || ""}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11.5px] text-ink-3">
              Darker = more of that lab&apos;s models on that provider. <span className="text-copper">Copper outline</span> = the lab&apos;s own first-party API. Top 14 labs × top 16 providers by size.
            </p>
          </div>
        </Panel>

        <Panel title="Capability coverage — share of each lab's active models" flush>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                  <th className="pb-2 font-medium">Lab</th>
                  {e.capabilities.map((c) => (
                    <th key={c} className="pb-2 font-medium">
                      {capabilityLabel(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {e.labs.map((l, li) => (
                  <tr key={l.slug} className="border-t border-line">
                    <td className="py-2 pr-3">
                      <Link href={`/labs/${l.slug}`} className="text-ink hover:underline">
                        {l.name}
                      </Link>
                    </td>
                    {e.coverage[li].map((v, ci) => (
                      <td key={ci} className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="h-[6px] w-full max-w-[90px] overflow-hidden rounded-none bg-surface-3">
                            <span className="block h-full rounded-none bg-copper" style={{ width: `${v * 100}%` }} />
                          </span>
                          <span className="num w-8 text-right text-ink-2">{Math.round(v * 100)}%</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Container>
    </>
  );
}
