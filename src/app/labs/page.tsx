import type { Metadata } from "next";
import Link from "next/link";
import { listLabs } from "@/server/queries/directory";
import { Container, PageHeader, Tag } from "@/components/ui/primitives";
import { LabMark } from "@/components/identity/LabMark";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { fmtMonth } from "@/lib/format";

export const metadata: Metadata = { title: "AI labs", description: "Directory of AI labs and model developers." };
export const revalidate = 600;

export default async function LabsPage() {
  const labs = await listLabs();
  const curated = labs.filter((l) => l.isCurated);
  const others = labs.filter((l) => !l.isCurated);
  return (
    <>
      <PageHeader sheet="08"
        eyebrow="Directory"
        title="AI labs"
        description="The organisations that build models. Labs are distinct from providers: a lab trains a model, providers serve it. Some labs also run a first-party API."
      />
      <Container className="py-6">
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {curated.map((l) => (
            <StaggerItem key={l.slug}>
              <Link href={`/labs/${l.slug}`} className="group flex h-full flex-col rounded-none border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]" data-testid="lab-card">
                <div className="flex items-start gap-3">
                  <LabMark slug={l.slug} name={l.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[19px] leading-tight text-ink">{l.name}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      {[l.headquarters, l.foundedYear && `est. ${l.foundedYear}`].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-[12.5px] leading-snug text-ink-2">{l.description}</p>
                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3 text-[11px] text-ink-3">
                  <div>
                    Models<div className="num text-[15px] text-ink">{l.modelCount}</div>
                  </div>
                  <div>
                    Families<div className="num text-[15px] text-ink">{l.familyCount}</div>
                  </div>
                  <div>
                    Latest<div className="text-[12.5px] text-ink">{fmtMonth(l.latestRelease)}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {l.openWeightsCount > 0 && <Tag tone="accent">{l.openWeightsCount} open weights</Tag>}
                  {l.firstPartyProviders.length > 0 && <Tag tone="outline">First-party API</Tag>}
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>

        {others.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-1 font-display text-[20px] text-ink">Other developers</h2>
            <p className="mb-3 text-[12.5px] text-ink-3">Identified from model identifiers in the catalogue; no curated profile yet.</p>
            <div className="grid gap-px overflow-hidden rounded-none border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {others.map((l) => (
                <Link key={l.slug} href={`/labs/${l.slug}`} className="flex items-center gap-2.5 bg-surface px-3 py-2.5 hover:bg-surface-2">
                  <LabMark slug={l.slug} size={24} />
                  <span className="flex-1 truncate text-[13px] text-ink">{l.name}</span>
                  <span className="num text-[11.5px] text-ink-3">{l.modelCount}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
