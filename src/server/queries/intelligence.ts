/** Rankings, benchmarks, comparison, search, recommendations and engine telemetry. */
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { modelCardSelect, toCard, getModel } from "./models";
import { composite, DEFAULT_WEIGHTS, DIMENSION_LABELS, type DimensionKey, type Weights } from "../scoring/engine";
import { getWorkload, recommend, type Candidate, type Constraints } from "../recommend/workloads";

const ACTIVE: Prisma.ModelWhereInput = { status: { in: ["ACTIVE", "DEPRECATED"] } };

export type ScoreOrigin = "external" | "derived" | "specification";

export interface RankingRow {
  rank: number;
  model: ReturnType<typeof toCard>;
  value: number;
  display: string;
  origin: ScoreOrigin;
  source: string;
  observedAt: string | null;
  confidence?: number;
}

// ─────────────────────────── rankings ───────────────────────────

interface RankingArgs {
  category: string;
  benchmark?: string;
  type: string[];
  capability: string[];
  weights?: Weights | null;
  minConfidence?: number;
  limit: number;
}

function baseWhere(a: RankingArgs): Prisma.ModelWhereInput {
  const and: Prisma.ModelWhereInput[] = [ACTIVE];
  if (a.type.length) and.push({ type: { in: a.type as never } });
  for (const c of a.capability) and.push({ capabilities: { some: { capability: { slug: c } } } });
  return { AND: and };
}

export async function getRankings(a: RankingArgs): Promise<{ title: string; description: string; origin: ScoreOrigin; rows: RankingRow[]; weights?: Weights }> {
  const where = baseWhere(a);

  // external benchmark leaderboards
  const benchSlug =
    a.category === "intelligence" ? "aa-intelligence-index" : a.category === "coding" ? "aa-coding-index" : a.category === "agentic" ? "aa-agentic-index" : a.category === "design" ? a.benchmark ?? "design-arena-codecategories" : a.benchmark;
  if (benchSlug && (["intelligence", "coding", "agentic", "design"].includes(a.category) || a.benchmark)) {
    const bench = await prisma.benchmark.findUnique({ where: { slug: benchSlug }, include: { source: true } });
    if (!bench) return { title: "Unknown benchmark", description: "", origin: "external", rows: [] };
    const results = await prisma.benchmarkResult.findMany({
      where: { benchmarkId: bench.id, model: where },
      orderBy: [{ score: bench.higherIsBetter ? "desc" : "asc" }, { model: { slug: "asc" } }],
      take: a.limit,
      include: { model: { select: modelCardSelect } },
    });
    return {
      title: bench.name,
      description: bench.description,
      origin: "external",
      rows: results.map((r, i) => ({
        rank: i + 1,
        model: toCard(r.model),
        value: r.score,
        display: bench.scaleLabel === "Elo rating" ? Math.round(r.score).toString() : r.score.toFixed(1),
        origin: "external" as const,
        source: bench.source.name,
        observedAt: r.observedAt.toISOString(),
      })),
    };
  }

  if (a.category === "long-context" || a.category === "cheapest") {
    const isCtx = a.category === "long-context";
    const rows = await prisma.model.findMany({
      where: { AND: [where, isCtx ? { contextLength: { not: null } } : { blendedPrice: { gt: 0 } }, { type: { in: ["CHAT", "REASONING", "MULTIMODAL"] } }] },
      orderBy: isCtx ? [{ contextLength: "desc" }, { blendedPrice: { sort: "asc", nulls: "last" } }] : [{ blendedPrice: "asc" }, { score: { overall: { sort: "desc", nulls: "last" } } }],
      take: a.limit,
      select: { ...modelCardSelect, lastSyncedAt: true },
    });
    return {
      title: isCtx ? "Longest context windows" : "Lowest blended price",
      description: isCtx ? "Published maximum context length across text-capable models." : "Cheapest paid offering per model, 3:1 input:output blend per 1M tokens. Free tiers excluded.",
      origin: "specification",
      rows: rows.map((m, i) => ({
        rank: i + 1,
        model: toCard(m),
        value: isCtx ? (m.contextLength ?? 0) : Number(m.blendedPrice),
        display: isCtx ? `${Math.round((m.contextLength ?? 0) / 1000).toLocaleString("en-US")}K` : `$${Number(m.blendedPrice).toFixed(3)}`,
        origin: "specification" as const,
        source: "OpenRouter catalogue",
        observedAt: m.lastSyncedAt.toISOString(),
      })),
    };
  }

  // derived Atlas leaderboards (overall / value), with optional custom weights
  const weights: Weights = a.category === "value" ? { value: 1 } : a.weights ?? DEFAULT_WEIGHTS;
  const minConfidence = a.minConfidence ?? (a.category === "value" ? 0 : 0.7);
  const rows = await prisma.model.findMany({
    where: { AND: [where, { score: { isNot: null } }] },
    select: { ...modelCardSelect, score: true },
  });
  const ranked = rows
    .map((m) => {
      const s = m.score!;
      const dims = { capability: s.capability, coding: s.coding, agentic: s.agentic, costEfficiency: s.costEfficiency, value: s.value, context: s.context, availability: s.availability, versatility: s.versatility };
      const c = composite(dims, weights, 0);
      return { m, c };
    })
    .filter(({ c }) => c.overall != null && c.confidence >= minConfidence)
    .sort((x, y) => (y.c.overall as number) - (x.c.overall as number) || x.m.slug.localeCompare(y.m.slug))
    .slice(0, a.limit);
  return {
    title: a.category === "value" ? "Best value" : a.weights ? "Custom Atlas ranking" : "Atlas Intelligence Score",
    description:
      a.category === "value"
        ? "Atlas value dimension: geometric mean of capability percentile and cost efficiency. Requires both a published intelligence index and a known price."
        : "Weighted composite of eight Atlas dimensions. Models with less than 70% of the weight backed by data are excluded.",
    origin: "derived",
    weights,
    rows: ranked.map(({ m, c }, i) => ({
      rank: i + 1,
      model: toCard(m),
      value: c.overall as number,
      display: (c.overall as number).toFixed(1),
      origin: "derived" as const,
      source: "Atlas Engine (atlas-v1)",
      observedAt: m.score!.computedAt.toISOString(),
      confidence: c.confidence,
    })),
  };
}

// ─────────────────────────── benchmarks ───────────────────────────

export async function listBenchmarks() {
  const b = await prisma.benchmark.findMany({ include: { source: true, _count: { select: { results: true } } }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return b.map((x) => ({
    slug: x.slug,
    name: x.name,
    category: x.category,
    description: x.description,
    scaleLabel: x.scaleLabel,
    scaleMin: x.scaleMin,
    scaleMax: x.scaleMax,
    isSynthetic: x.isSynthetic,
    methodologyUrl: x.methodologyUrl,
    source: { name: x.source.name, url: x.source.url, kind: x.source.kind, lastSuccessAt: x.source.lastSuccessAt?.toISOString() ?? null },
    coverage: x._count.results,
  }));
}

/** Matrix of models × benchmarks. Cells hold raw score + percentile (for cross-scale colouring). */
export async function getBenchmarkMatrix(benchmarkSlugs: string[], limit: number) {
  const benches = await prisma.benchmark.findMany({ where: { slug: { in: benchmarkSlugs } } });
  const ordered = benchmarkSlugs.map((s) => benches.find((b) => b.slug === s)).filter((b): b is NonNullable<typeof b> => !!b);
  if (!ordered.length) return { benchmarks: [], rows: [] };
  const anchor = ordered[0];
  const top = await prisma.benchmarkResult.findMany({ where: { benchmarkId: anchor.id, model: ACTIVE }, orderBy: { score: "desc" }, take: limit, select: { modelId: true } });
  const ids = top.map((t) => t.modelId);
  const results = await prisma.benchmarkResult.findMany({ where: { modelId: { in: ids }, benchmarkId: { in: ordered.map((b) => b.id) } } });
  const models = await prisma.model.findMany({ where: { id: { in: ids } }, select: { ...modelCardSelect, id: true } });
  const mmap = new Map(models.map((m) => [m.id, m]));
  return {
    benchmarks: ordered.map((b) => ({ slug: b.slug, name: b.name, scaleLabel: b.scaleLabel, category: b.category })),
    rows: ids.map((id) => ({
      model: toCard(mmap.get(id)!),
      cells: ordered.map((b) => {
        const r = results.find((x) => x.modelId === id && x.benchmarkId === b.id);
        return r ? { score: r.score, percentile: r.percentile } : null;
      }),
    })),
  };
}

// ─────────────────────────── compare ───────────────────────────

export async function compareModels(slugs: string[]) {
  const details = await Promise.all(slugs.map((s) => getModel(s)));
  const found = details.filter((d): d is NonNullable<typeof d> => !!d);
  const missing = slugs.filter((s) => !found.some((f) => f.slug === s));
  // union of benchmarks any compared model has, for an aligned table
  const benchmarkSlugs = [...new Set(found.flatMap((f) => f.benchmarks.map((b) => b.slug)))];
  const dims = Object.keys(DIMENSION_LABELS) as DimensionKey[];
  return {
    models: found,
    missing,
    benchmarks: benchmarkSlugs.map((slug) => {
      const meta = found.flatMap((f) => f.benchmarks).find((b) => b.slug === slug)!;
      return { slug, name: meta.name, category: meta.category, scaleLabel: meta.scaleLabel, values: found.map((f) => f.benchmarks.find((b) => b.slug === slug) ?? null) };
    }),
    dimensions: dims.map((k) => ({ key: k, label: DIMENSION_LABELS[k], values: found.map((f) => f.score?.traces.find((t) => t.key === k)?.score ?? null) })),
  };
}

// ─────────────────────────── search ───────────────────────────

export async function search(q: string, limit: number) {
  const term = q.trim();
  const ci = { contains: term, mode: "insensitive" as const };
  const [models, labs, providers] = await Promise.all([
    prisma.model.findMany({
      where: { AND: [ACTIVE, { OR: [{ name: ci }, { externalId: ci }, { family: { name: ci } }] }] },
      select: { slug: true, name: true, externalId: true, type: true, lab: { select: { name: true, slug: true } }, providerCount: true, score: { select: { overall: true } } },
      orderBy: [{ providerCount: "desc" }, { releasedAt: "desc" }],
      take: limit * 3,
    }),
    prisma.lab.findMany({ where: { name: ci }, select: { slug: true, name: true, _count: { select: { models: { where: ACTIVE } } } }, take: limit }),
    prisma.provider.findMany({ where: { name: ci, offeringCount: { gt: 0 } }, select: { slug: true, name: true, offeringCount: true }, take: limit }),
  ]);
  // rank: exact > prefix > word-prefix > contains
  const lower = term.toLowerCase();
  const rank = (name: string) => {
    const n = name.toLowerCase();
    if (n === lower) return 0;
    if (n.startsWith(lower)) return 1;
    if (n.split(/[\s-]/).some((w) => w.startsWith(lower))) return 2;
    return 3;
  };
  return {
    models: models.sort((a, b) => rank(a.name) - rank(b.name) || b.providerCount - a.providerCount).slice(0, limit),
    labs: labs.filter((l) => l._count.models > 0).map((l) => ({ slug: l.slug, name: l.name, modelCount: l._count.models })),
    providers: providers.map((p) => ({ slug: p.slug, name: p.name, offeringCount: p.offeringCount })),
  };
}

// ─────────────────────────── recommendations ───────────────────────────

export async function getRecommendations(workloadSlug: string, k: Constraints, limit: number) {
  const workload = getWorkload(workloadSlug);
  if (!workload) return null;
  const rows = await prisma.model.findMany({ where: { AND: [ACTIVE, { score: { isNot: null } }] }, select: { ...modelCardSelect, score: true } });
  const cards = new Map(rows.map((r) => [r.slug, r]));
  const candidates: Candidate[] = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    type: r.type,
    contextLength: r.contextLength,
    blendedPrice: r.blendedPrice == null ? null : Number(r.blendedPrice),
    isFree: r.isFree,
    isOpenWeights: r.isOpenWeights,
    capabilities: r.capabilities.map((c) => c.capability.slug),
    providerCount: r.providerCount,
    dimensions: {
      capability: r.score!.capability,
      coding: r.score!.coding,
      agentic: r.score!.agentic,
      costEfficiency: r.score!.costEfficiency,
      value: r.score!.value,
      context: r.score!.context,
      availability: r.score!.availability,
      versatility: r.score!.versatility,
    },
  }));
  const recs = recommend(candidates, workload, k, limit);
  return { workload, results: recs.map((r) => ({ ...r, model: toCard(cards.get(r.slug)!) })), candidates: candidates.length };
}

// ─────────────────────────── overview + engine telemetry ───────────────────────────

export async function getOverview() {
  const [models, labs, providers, offerings, benchmarks, results, byType, recent, changes, lastJob, free, open] = await Promise.all([
    prisma.model.count({ where: ACTIVE }),
    prisma.lab.count({ where: { models: { some: ACTIVE } } }),
    prisma.provider.count({ where: { offeringCount: { gt: 0 } } }),
    prisma.offering.count({ where: { isActive: true, model: ACTIVE } }),
    prisma.benchmark.count(),
    prisma.benchmarkResult.count(),
    prisma.model.groupBy({ by: ["type"], where: ACTIVE, _count: true }),
    prisma.model.findMany({ where: ACTIVE, orderBy: { releasedAt: "desc" }, take: 8, select: modelCardSelect }),
    getChangeFeed(12),
    prisma.ingestionJob.findFirst({ where: { dryRun: false, status: { in: ["SUCCEEDED", "PARTIAL"] } }, orderBy: { startedAt: "desc" } }),
    prisma.model.count({ where: { ...ACTIVE, isFree: true } }),
    prisma.model.count({ where: { ...ACTIVE, isOpenWeights: true } }),
  ]);
  const featured = await prisma.model.findMany({
    where: { AND: [ACTIVE, { score: { confidence: { gte: 0.9 } } }, { type: { in: ["CHAT", "REASONING", "MULTIMODAL"] } }] },
    orderBy: { score: { overall: "desc" } },
    take: 6,
    select: modelCardSelect,
  });
  const bestValue = await prisma.model.findMany({
    where: { AND: [ACTIVE, { score: { value: { not: null } } }] },
    orderBy: { score: { value: "desc" } },
    take: 5,
    select: modelCardSelect,
  });
  const landscape = await getLandscape();
  return {
    counts: { models, labs, providers, offerings, benchmarks, results, free, openWeights: open },
    byType: byType.map((t) => ({ type: t.type, count: t._count })).sort((a, b) => b.count - a.count),
    recent: recent.map(toCard),
    featured: featured.map(toCard),
    bestValue: bestValue.map(toCard),
    landscape,
    changes,
    lastSync: lastJob?.finishedAt?.toISOString() ?? null,
  };
}

export async function getChangeFeed(limit = 30, kinds?: string[]) {
  const rows = await prisma.changeEvent.findMany({
    where: kinds?.length ? { kind: { in: kinds as never } } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { model: { select: { slug: true, name: true, lab: { select: { name: true } } } } },
  });
  return rows.map((c) => ({ id: c.id, kind: c.kind, subject: c.subject, field: c.field, before: c.before, after: c.after, at: c.createdAt.toISOString(), model: c.model }));
}

export async function getEngineStatus() {
  const [jobs, sources, tables] = await Promise.all([
    prisma.ingestionJob.findMany({ orderBy: { startedAt: "desc" }, take: 15, include: { source: { select: { name: true } }, _count: { select: { changes: true } } } }),
    prisma.dataSource.findMany({ include: { _count: { select: { models: true, benchmarkResults: true } } } }),
    Promise.all([
      prisma.model.count(),
      prisma.lab.count(),
      prisma.modelFamily.count(),
      prisma.provider.count(),
      prisma.offering.count(),
      prisma.price.count(),
      prisma.priceSnapshot.count(),
      prisma.benchmark.count(),
      prisma.benchmarkResult.count(),
      prisma.modelScore.count(),
      prisma.changeEvent.count(),
      prisma.modelCapability.count(),
    ]),
  ]);
  const [model, lab, family, provider, offering, price, snapshot, benchmark, result, score, change, capability] = tables;
  return {
    jobs: jobs.map((j) => ({
      id: j.id,
      source: j.source.name,
      status: j.status,
      trigger: j.trigger,
      dryRun: j.dryRun,
      isBaseline: j.isBaseline,
      startedAt: j.startedAt.toISOString(),
      finishedAt: j.finishedAt?.toISOString() ?? null,
      stats: j.stats as Record<string, number> | null,
      stages: (j.stages as { stage: string; ms: number; in: number; out: number; note?: string }[] | null) ?? [],
      errors: ((j.errors as { ref: string; message: string }[] | null) ?? []).slice(0, 20),
      errorCount: ((j.errors as unknown[] | null) ?? []).length,
      changeCount: j._count.changes,
    })),
    sources: sources.map((s) => ({ slug: s.slug, name: s.name, url: s.url, kind: s.kind, description: s.description, termsNote: s.termsNote, lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null, models: s._count.models, results: s._count.benchmarkResults })),
    tables: { model, lab, family, provider, offering, price, snapshot, benchmark, result, score, change, capability },
  };
}

// ─────────────────────────── ecosystem ───────────────────────────

/** Lab × provider matrix ("who serves whom") and per-lab capability coverage. */
export async function getEcosystem() {
  const pairs = await prisma.$queryRaw<{ lab_id: string; provider_id: string; n: bigint }[]>`
    SELECT m."labId" AS lab_id, o."providerId" AS provider_id, COUNT(DISTINCT m.id) AS n
    FROM "Offering" o JOIN "Model" m ON m.id = o."modelId"
    WHERE o."isActive" = true AND m.status IN ('ACTIVE', 'DEPRECATED')
    GROUP BY m."labId", o."providerId"`;
  const labs = await prisma.lab.findMany({
    where: { models: { some: ACTIVE } },
    select: { id: true, slug: true, name: true, providers: { select: { id: true } }, _count: { select: { models: { where: ACTIVE }, families: true } } },
  });
  const providers = await prisma.provider.findMany({ where: { offeringCount: { gt: 0 } }, select: { id: true, slug: true, name: true, offeringCount: true }, orderBy: { offeringCount: "desc" } });
  const topLabs = labs.sort((a, b) => b._count.models - a._count.models).slice(0, 14);
  const topProviders = providers.slice(0, 16);
  const cell = new Map(pairs.map((p) => [`${p.lab_id}:${p.provider_id}`, Number(p.n)]));

  const capRows = await prisma.$queryRaw<{ lab_id: string; slug: string; n: bigint }[]>`
    SELECT m."labId" AS lab_id, c.slug, COUNT(*) AS n
    FROM "ModelCapability" mc JOIN "Model" m ON m.id = mc."modelId" JOIN "Capability" c ON c.id = mc."capabilityId"
    WHERE m.status IN ('ACTIVE', 'DEPRECATED')
    GROUP BY m."labId", c.slug`;
  const caps = ["reasoning", "tools", "vision", "structured-outputs", "long-context", "open-weights"];
  const capMap = new Map(capRows.map((r) => [`${r.lab_id}:${r.slug}`, Number(r.n)]));

  return {
    labs: topLabs.map((l) => ({ slug: l.slug, name: l.name, models: l._count.models, families: l._count.families })),
    providers: topProviders.map((p) => ({ slug: p.slug, name: p.name, offerings: p.offeringCount })),
    matrix: topLabs.map((l) =>
      topProviders.map((p) => ({ n: cell.get(`${l.id}:${p.id}`) ?? 0, firstParty: l.providers.some((x) => x.id === p.id) })),
    ),
    capabilities: caps,
    coverage: topLabs.map((l) => caps.map((c) => (l._count.models ? (capMap.get(`${l.id}:${c}`) ?? 0) / l._count.models : 0))),
    totals: { pairs: pairs.length, labs: labs.length, providers: providers.length },
  };
}

/** Every priced model with an AA Intelligence Index: the stations on the OneAtlas datum. */
export async function getLandscape() {
  const rows = await prisma.model.findMany({
    where: { AND: [ACTIVE, { blendedPrice: { gt: 0 } }, { results: { some: { benchmark: { slug: "aa-intelligence-index" } } } }] },
    select: { slug: true, name: true, blendedPrice: true, lab: { select: { name: true, slug: true } }, results: { where: { benchmark: { slug: "aa-intelligence-index" } }, select: { score: true } } },
  });
  return rows.map((l) => ({ slug: l.slug, name: l.name, lab: l.lab.name, labSlug: l.lab.slug, price: Number(l.blendedPrice), intelligence: l.results[0].score }));
}
