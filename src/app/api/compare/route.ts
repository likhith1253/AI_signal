import { handler, HttpError, ok, parseQuery } from "@/lib/api";
import { compareQuery } from "@/lib/validation";
import { compareModels } from "@/server/queries/intelligence";

/** GET /api/compare?models=a,b,c - aligned side-by-side comparison of up to 4 models. */
export const GET = handler(async (req) => {
  const q = parseQuery(compareQuery, req.url);
  const data = await compareModels(q.models);
  if (!data.models.length) throw new HttpError(404, "not_found", `None of the requested models exist: ${q.models.join(", ")}`);
  return ok(data, { requested: q.models.length, found: data.models.length });
});
