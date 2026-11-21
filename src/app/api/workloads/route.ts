import { handler, ok } from "@/lib/api";
import { WORKLOADS } from "@/server/recommend/workloads";

/** GET /api/workloads — declarative workload profiles used by the recommender. */
export const GET = handler(async () => ok(WORKLOADS, undefined, { revalidate: 3600 }));
