import { handler, ok, requireBearer } from "@/lib/api";
import { prisma } from "@/server/db/client";
import { runIngest } from "@/server/ingest/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** GET /api/cron/ingest — invoked by Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`. */
export const GET = handler(async (req) => {
  requireBearer(req, process.env.CRON_SECRET);
  const r = await runIngest(prisma, { trigger: "cron" });
  return ok({ jobId: r.jobId, summary: r.summary, errors: r.errors.length }, undefined, { revalidate: 0 });
});
