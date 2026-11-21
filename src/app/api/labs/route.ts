import { handler, ok } from "@/lib/api";
import { listLabs } from "@/server/queries/directory";

/** GET /api/labs — AI labs / model developers. */
export const GET = handler(async () => {
  const data = await listLabs();
  return ok(data, { total: data.length });
});
