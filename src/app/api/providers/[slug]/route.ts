import { handler, HttpError, ok } from "@/lib/api";
import { getProvider } from "@/server/queries/directory";

/** GET /api/providers/:slug — provider catalogue with price premium vs the cheapest alternative. */
export const GET = handler<{ params: Promise<{ slug: string }> }>(async (_req, { params }) => {
  const { slug } = await params;
  const p = await getProvider(slug.slice(0, 80));
  if (!p) throw new HttpError(404, "not_found", `No provider with slug "${slug}"`);
  return ok(p);
});
