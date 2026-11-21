import { handler, HttpError, ok } from "@/lib/api";
import { getLab } from "@/server/queries/directory";

/** GET /api/labs/:slug — lab profile, families, models and serving providers. */
export const GET = handler<{ params: Promise<{ slug: string }> }>(async (_req, { params }) => {
  const { slug } = await params;
  const lab = await getLab(slug.slice(0, 80));
  if (!lab) throw new HttpError(404, "not_found", `No lab with slug "${slug}"`);
  return ok(lab);
});
