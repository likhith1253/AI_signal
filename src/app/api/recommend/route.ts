import { handler, HttpError, ok, parseQuery } from "@/lib/api";
import { recommendQuery } from "@/lib/validation";
import { getRecommendations } from "@/server/queries/intelligence";

/** GET /api/recommend?workload=software-development&maxPrice=2 - deterministic, explained picks. */
export const GET = handler(async (req) => {
  const q = parseQuery(recommendQuery, req.url);
  const r = await getRecommendations(q.workload, { maxBlendedPrice: q.maxPrice, minContext: q.minContext, openWeightsOnly: q.openWeights }, q.limit);
  if (!r) throw new HttpError(404, "not_found", `Unknown workload "${q.workload}"`);
  return ok(r.results, { workload: r.workload, candidates: r.candidates });
});
