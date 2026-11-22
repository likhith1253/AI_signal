/** Derive stage: recompute everything OneAtlas calculates from source data. */
import type { PrismaClient } from "@prisma/client";
import { blendedPrice } from "./normalize";
import { composite, METHODOLOGY, scoreModel, type Population, type ScoreInput } from "../scoring/engine";

const asc = (xs: number[]) => [...xs].sort((a, b) => a - b);

export async function deriveAll(db: PrismaClient): Promise<{ scored: number; percentiles: number }> {
  const models = await db.model.findMany({
    where: { status: { not: "REMOVED" } },
    select: {
      id: true,
      contextLength: true,
      offerings: {
        where: { isActive: true },
        select: { uptime1d: true, prices: { where: { minPromptTokens: 0, component: { in: ["INPUT", "OUTPUT"] } } } },
      },
      modalities: { where: { direction: "INPUT" }, select: { modality: { select: { slug: true } } } },
      capabilities: { select: { capability: { select: { slug: true } } } },
      results: { select: { score: true, benchmark: { select: { slug: true } } } },
    },
  });
  type Agg = { minIn: number | null; minOut: number | null; blended: number | null; free: boolean; providers: number; uptime: number | null };
  const aggs = new Map<string, Agg>();
  for (const m of models) {
    let minIn: number | null = null;
    let minOut: number | null = null;
    let best: number | null = null;
    let free = false;
    let uptime: number | null = null;
    for (const o of m.offerings) {
      const inp = o.prices.find((p) => p.component === "INPUT" && !p.isVariable);
      const out = o.prices.find((p) => p.component === "OUTPUT" && !p.isVariable);
      const i = inp?.amountUsd == null ? null : Number(inp.amountUsd);
      const ou = out?.amountUsd == null ? null : Number(out.amountUsd);
      if (i != null) minIn = minIn == null ? i : Math.min(minIn, i);
      if (ou != null) minOut = minOut == null ? ou : Math.min(minOut, ou);
      const b = blendedPrice(i, ou);
      if (b != null) best = best == null ? b : Math.min(best, b);
      if (i === 0 && ou === 0) free = true;
      if (o.uptime1d != null) uptime = uptime == null ? o.uptime1d : Math.max(uptime, o.uptime1d);
    }
    aggs.set(m.id, { minIn, minOut, blended: best, free, providers: m.offerings.length, uptime });
  }
  // One set-based statement instead of N updates. Mid-rank percentile:
  // (models strictly below + half of ties) / models on that benchmark - the
  // same definition as engine.percentile(), so traces and stored values agree.
  const percentiles = await db.$executeRaw`
    UPDATE "BenchmarkResult" AS br
    SET "percentile" = CASE WHEN b."higherIsBetter" THEN sub.p ELSE 1 - sub.p END
    FROM (
      SELECT id, "benchmarkId",
        ((RANK() OVER w - 1) + (COUNT(*) OVER (PARTITION BY "benchmarkId", score)) / 2.0)
          / COUNT(*) OVER (PARTITION BY "benchmarkId") AS p
      FROM "BenchmarkResult"
      WINDOW w AS (PARTITION BY "benchmarkId" ORDER BY score)
    ) AS sub, "Benchmark" AS b
    WHERE br.id = sub.id AND b.id = sub."benchmarkId"`;
  const bench = (m: (typeof models)[number], slug: string) => m.results.find((r) => r.benchmark.slug === slug)?.score ?? null;
  const pop: Population = {
    intelligence: asc(models.map((m) => bench(m, "aa-intelligence-index")).filter((x): x is number => x != null)),
    coding: asc(models.map((m) => bench(m, "aa-coding-index")).filter((x): x is number => x != null)),
    agentic: asc(models.map((m) => bench(m, "aa-agentic-index")).filter((x): x is number => x != null)),
    codeArena: asc(models.map((m) => bench(m, "design-arena-codecategories")).filter((x): x is number => x != null)),
    prices: asc([...aggs.values()].map((a) => a.blended).filter((x): x is number => x != null && x > 0)),
  };

  const writes = [];
  for (const m of models) {
    const a = aggs.get(m.id)!;
    const input: ScoreInput = {
      intelligenceIndex: bench(m, "aa-intelligence-index"),
      codingIndex: bench(m, "aa-coding-index"),
      agenticIndex: bench(m, "aa-agentic-index"),
      codeArenaElo: bench(m, "design-arena-codecategories"),
      blendedPrice: a.blended,
      isFree: a.free,
      contextLength: m.contextLength,
      providerCount: a.providers,
      bestUptime: a.uptime,
      inputModalities: m.modalities.map((x) => x.modality.slug),
      capabilities: m.capabilities.map((x) => x.capability.slug),
    };
    const { dimensions } = scoreModel(input, pop);
    const comp = composite(dimensions);
    writes.push(
      db.model.update({
        where: { id: m.id },
        data: { minInputPrice: a.minIn, minOutputPrice: a.minOut, blendedPrice: a.blended, isFree: a.free, providerCount: a.providers },
      }),
      db.modelScore.upsert({
        where: { modelId: m.id },
        create: { modelId: m.id, methodology: METHODOLOGY, overall: comp.overall, confidence: comp.confidence, ...dimensions },
        update: { methodology: METHODOLOGY, overall: comp.overall, confidence: comp.confidence, ...dimensions, computedAt: new Date() },
      }),
    );
  }
  for (let i = 0; i < writes.length; i += 300) await db.$transaction(writes.slice(i, i + 300));
  const counts = await db.offering.groupBy({ by: ["providerId"], where: { isActive: true, model: { status: { not: "REMOVED" } } }, _count: true });
  await db.provider.updateMany({ data: { offeringCount: 0 } });
  await db.$transaction(counts.map((c) => db.provider.update({ where: { id: c.providerId }, data: { offeringCount: c._count } })));

  return { scored: models.length, percentiles };
}

/** Build the score input + population for a single model on demand (for traces). */
export async function loadPopulation(db: PrismaClient): Promise<Population> {
  const rows = await db.benchmarkResult.findMany({
    where: { benchmark: { slug: { in: ["aa-intelligence-index", "aa-coding-index", "aa-agentic-index", "design-arena-codecategories"] } }, model: { status: { not: "REMOVED" } } },
    select: { score: true, benchmark: { select: { slug: true } } },
  });
  const pick = (slug: string) => asc(rows.filter((r) => r.benchmark.slug === slug).map((r) => r.score));
  const prices = await db.model.findMany({ where: { status: { not: "REMOVED" }, blendedPrice: { gt: 0 } }, select: { blendedPrice: true } });
  return {
    intelligence: pick("aa-intelligence-index"),
    coding: pick("aa-coding-index"),
    agentic: pick("aa-agentic-index"),
    codeArena: pick("design-arena-codecategories"),
    prices: asc(prices.map((p) => Number(p.blendedPrice))),
  };
}
