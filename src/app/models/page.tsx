import type { Metadata } from "next";
import { Suspense } from "react";
import { modelListQuery, searchParamsToObject } from "@/lib/validation";
import { getModelFacets, listModels } from "@/server/queries/models";
import { PageHeader, Container } from "@/components/ui/primitives";
import { FilterControls, MobileFilters, SearchBox } from "@/components/models/FilterPanel";
import { ActiveFilters, ModelResults } from "@/components/models/ModelResults";

export const metadata: Metadata = { title: "Models", description: "Search, filter and sort every model in the OneAtlas registry." };
export const revalidate = 300;

export default async function ModelsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = searchParamsToObject(await searchParams);
  const parsed = modelListQuery.safeParse(raw);
  const q = parsed.success ? parsed.data : modelListQuery.parse({});
  const [result, facets] = await Promise.all([listModels(q), getModelFacets()]);
  const labels: Record<string, string> = {};
  for (const l of facets.labs) labels[`lab:${l.value}`] = l.label;
  for (const p of facets.providers) labels[`provider:${p.value}`] = p.label;
  const activeCount = q.type.length + q.capability.length + q.modality.length + q.lab.length + q.provider.length + (q.maxPrice != null ? 1 : 0) + (q.minContext ? 1 : 0) + (q.free ? 1 : 0) + (q.openWeights ? 1 : 0);

  return (
    <>
      <PageHeader
        eyebrow="Model registry"
        title="Discover models"
        description={
          <>
            One identity per model, regardless of how many providers serve it. Prices shown are the cheapest active offering; blended price uses a 3:1 input:output mix.
          </>
        }
      />
      <Container className="py-6">
        <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-[72px] max-h-[calc(100dvh-88px)] overflow-y-auto pr-1 scrollbar-thin" data-testid="filter-panel">
              <Suspense>
                <FilterControls facets={facets} />
              </Suspense>
            </div>
          </aside>
          <div className="min-w-0">
            <div className="mb-3 flex gap-2">
              <Suspense>
                <SearchBox />
                <MobileFilters facets={facets} activeCount={activeCount} />
              </Suspense>
            </div>
            <div className="mb-3">
              <Suspense>
                <ActiveFilters labels={labels} />
              </Suspense>
            </div>
            <Suspense>
              <ModelResults items={result.items} total={result.total} page={result.page} pageCount={result.pageCount} sort={q.sort} />
            </Suspense>
          </div>
        </div>
      </Container>
    </>
  );
}
