import { handler, ok, parseQuery } from "@/lib/api";
import { modelListQuery } from "@/lib/validation";
import { listModels } from "@/server/queries/models";

/** GET /api/models — search, filter, sort and paginate the model registry. */
export const GET = handler(async (req) => {
  const q = parseQuery(modelListQuery, req.url);
  const { items, ...page } = await listModels(q);
  return ok(items, { ...page, sort: q.sort });
});
