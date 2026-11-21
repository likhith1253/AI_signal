import { handler, ok } from "@/lib/api";
import { listProviders } from "@/server/queries/directory";

/** GET /api/providers — API providers serving at least one model. */
export const GET = handler(async () => {
  const data = await listProviders();
  return ok(data, { total: data.length });
});
