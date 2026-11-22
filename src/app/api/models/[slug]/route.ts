import { handler, HttpError, ok } from "@/lib/api";
import { getModel } from "@/server/queries/models";

/** GET /api/models/:slug - full model record: offerings, prices, benchmarks, score trace, change ledger. */
export const GET = handler<{ params: Promise<{ slug: string }> }>(async (_req, { params }) => {
  const { slug } = await params;
  const model = await getModel(slug.slice(0, 160));
  if (!model) throw new HttpError(404, "not_found", `No model with slug "${slug}"`);
  return ok(model);
});
