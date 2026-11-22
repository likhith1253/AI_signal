import { handler, ok, rateLimit, requireBearer } from "@/lib/api";
import { prisma } from "@/server/db/client";
import { runIngest } from "@/server/ingest/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/ingest           run the Atlas Engine (Authorization: Bearer $INGEST_SECRET)
 * POST /api/ingest?plan=1    dry run: returns the changeset without writing catalogue data
 */
export const POST = handler(async (req) => {
  const limited = rateLimit(req, 5, "ingest");
  if (limited) return limited;
  requireBearer(req, process.env.INGEST_SECRET);
  const plan = new URL(req.url).searchParams.get("plan") === "1";
  const r = await runIngest(prisma, { plan, trigger: "api" });
  return ok(
    { jobId: r.jobId, plan: r.plan, baseline: r.baseline, summary: r.summary, stages: r.stages, changes: r.changes.slice(0, 200), errors: r.errors.slice(0, 50) },
    undefined,
    { revalidate: 0 },
  );
});
