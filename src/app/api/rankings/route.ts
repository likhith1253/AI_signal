import { handler, ok, parseQuery } from "@/lib/api";
import { rankingsQuery } from "@/lib/validation";
import { parseWeights } from "@/server/scoring/engine";
import { getRankings } from "@/server/queries/intelligence";

/**
 * GET /api/rankings?category=overall|intelligence|coding|agentic|value|long-context|cheapest|design
 * Optional: benchmark=<slug>, type=, capability=, weights=capability:0.5,value:0.5, minConfidence=
 * Each row carries `origin`: external benchmark, derived Atlas metric, or raw specification.
 */
export const GET = handler(async (req) => {
  const q = parseQuery(rankingsQuery, req.url);
  const r = await getRankings({ ...q, weights: parseWeights(q.weights) });
  return ok(r.rows, { title: r.title, description: r.description, origin: r.origin, weights: r.weights ?? null, category: q.category });
});
