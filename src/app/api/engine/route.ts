import { handler, ok } from "@/lib/api";
import { getEngineStatus } from "@/server/queries/intelligence";

/** GET /api/engine - ingestion jobs, stage timings, data sources and table cardinalities. */
export const GET = handler(async () => ok(await getEngineStatus(), undefined, { revalidate: 60 }));
