import { handler, ok, parseQuery } from "@/lib/api";
import { searchQuery } from "@/lib/validation";
import { search } from "@/server/queries/intelligence";

/** GET /api/search?q= - grouped instant search over models, labs and providers. */
export const GET = handler(async (req) => {
  const q = parseQuery(searchQuery, req.url);
  return ok(await search(q.q, q.limit), { q: q.q }, { revalidate: 60 });
});
