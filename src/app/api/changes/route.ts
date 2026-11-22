import { z } from "zod";
import { handler, ok, parseQuery } from "@/lib/api";
import { getChangeFeed } from "@/server/queries/intelligence";

const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), kind: z.string().max(200).optional() });

/** GET /api/changes - the Atlas change ledger (observed ecosystem changes, newest first). */
export const GET = handler(async (req) => {
  const p = parseQuery(query, req.url);
  const data = await getChangeFeed(p.limit, p.kind?.split(",").filter(Boolean));
  return ok(data, { total: data.length }, { revalidate: 120 });
});
