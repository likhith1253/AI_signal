import { handler, ok, parseQuery } from "@/lib/api";
import { benchmarksQuery } from "@/lib/validation";
import { getBenchmarkMatrix, listBenchmarks } from "@/server/queries/intelligence";

/** GET /api/benchmarks - benchmark registry with sources; add benchmarks=a,b for a model × benchmark matrix. */
export const GET = handler(async (req) => {
  const q = parseQuery(benchmarksQuery, req.url);
  if (q.benchmarks.length) {
    const matrix = await getBenchmarkMatrix(q.benchmarks, q.limit);
    return ok(matrix, { total: matrix.rows.length });
  }
  const all = await listBenchmarks();
  const list = q.category ? all.filter((b) => b.category === q.category) : all;
  return ok(list, { total: list.length });
});
