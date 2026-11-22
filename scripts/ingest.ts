/** CLI: npm run ingest (add -- --plan for a dry run), npm run derive. */
import { PrismaClient } from "@prisma/client";
import { runIngest } from "../src/server/ingest/pipeline";
import { deriveAll } from "../src/server/ingest/derive";

const db = new PrismaClient();
const args = new Set(process.argv.slice(2));

async function main() {
  if (args.has("--derive-only")) {
    const t = performance.now();
    const r = await deriveAll(db);
    console.log(`derived ${r.scored} scores, ${r.percentiles} percentiles in ${Math.round(performance.now() - t)}ms`);
    return;
  }
  const plan = args.has("--plan");
  console.log(`\nAtlas Engine · ${plan ? "PLAN (dry run)" : "APPLY"}\n`);
  const res = await runIngest(db, { plan, trigger: "cli", log: (m) => console.log(m) });
  const s = res.summary;
  console.log(`\n${res.baseline ? "Baseline snapshot" : "Changeset"}:`);
  console.log(`  + ${s.added} models   - ${s.removed} removed   ~ ${s.updated} updated   = ${s.unchanged} unchanged`);
  console.log(`  ${s.priceChanges} price changes · ${s.offeringsAdded} offerings added · ${s.offeringsRemoved} removed · ${s.benchmarkChanges} benchmark updates`);
  if (!res.baseline) {
    for (const c of res.changes.slice(0, 25)) {
      const delta = c.before !== undefined || c.after !== undefined ? `  ${JSON.stringify(c.before ?? null)} → ${JSON.stringify(c.after ?? null)}` : "";
      console.log(`    ${c.kind.padEnd(18)} ${c.subject}${c.field ? ` [${c.field}]` : ""}${delta}`);
    }
    if (res.changes.length > 25) console.log(`    … ${res.changes.length - 25} more`);
  }
  if (res.errors.length) {
    console.log(`\n${res.errors.length} record(s) rejected or failed:`);
    for (const e of res.errors.slice(0, 10)) console.log(`  ${e.ref}: ${e.message}`);
  }
  console.log(`\njob ${res.jobId}${plan ? " (nothing written)" : ""}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
