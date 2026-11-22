import type { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import type { ModelListQuery } from "@/lib/validation";
import { loadPopulation } from "../ingest/derive";
import { composite, DEFAULT_WEIGHTS, scoreModel } from "../scoring/engine";
import { num } from "./util";
import { gridRef } from "@/lib/gridref";

/** Pure: translate validated filters into a Prisma where clause. */
export function buildModelWhere(q: Partial<ModelListQuery>): Prisma.ModelWhereInput {
  const and: Prisma.ModelWhereInput[] = [];
  if (!q.includeInactive) and.push({ status: { in: ["ACTIVE", "DEPRECATED"] } });
  if (q.q) {
    const term = q.q.trim();
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { externalId: { contains: term, mode: "insensitive" } },
        { lab: { name: { contains: term, mode: "insensitive" } } },
        { family: { name: { contains: term, mode: "insensitive" } } },
        { offerings: { some: { isActive: true, provider: { name: { contains: term, mode: "insensitive" } } } } },
      ],
    });
  }
  if (q.lab?.length) and.push({ lab: { slug: { in: q.lab } } });
  if (q.provider?.length) and.push({ offerings: { some: { isActive: true, provider: { slug: { in: q.provider } } } } });
  for (const m of q.modality ?? []) and.push({ modalities: { some: { direction: "INPUT", modality: { slug: m } } } });
  for (const m of q.output ?? []) and.push({ modalities: { some: { direction: "OUTPUT", modality: { slug: m } } } });
  for (const c of q.capability ?? []) and.push({ capabilities: { some: { capability: { slug: c } } } });
  if (q.type?.length) and.push({ type: { in: q.type } });
  if (q.free) and.push({ isFree: true });
  if (q.maxPrice != null) and.push({ OR: [{ isFree: true }, { blendedPrice: { lte: q.maxPrice } }] });
  if (q.minContext) and.push({ contextLength: { gte: q.minContext } });
  if (q.openWeights) and.push({ isOpenWeights: true });
  return and.length ? { AND: and } : {};
}

/** Pure: sort key -> orderBy. Unknown values (nulls) always sort last. */
export function buildModelOrder(sort: ModelListQuery["sort"], order?: "asc" | "desc"): Prisma.ModelOrderByWithRelationInput[] {
  const dir = (d: "asc" | "desc") => order ?? d;
  const tie: Prisma.ModelOrderByWithRelationInput = { slug: "asc" };
  switch (sort) {
    case "newest":
      return [{ releasedAt: { sort: dir("desc"), nulls: "last" } }, tie];
    case "input":
      return [{ minInputPrice: { sort: dir("asc"), nulls: "last" } }, tie];
    case "output":
      return [{ minOutputPrice: { sort: dir("asc"), nulls: "last" } }, tie];
    case "blended":
      return [{ blendedPrice: { sort: dir("asc"), nulls: "last" } }, tie];
    case "context":
      return [{ contextLength: { sort: dir("desc"), nulls: "last" } }, tie];
    case "name":
      return [{ name: dir("asc") }, tie];
    case "providers":
      return [{ providerCount: dir("desc") }, tie];
    case "score":
    default:
      return [{ score: { overall: { sort: dir("desc"), nulls: "last" } } }, tie];
  }
}

export const modelCardSelect = {
  slug: true,
  externalId: true,
  name: true,
  type: true,
  status: true,
  releasedAt: true,
  contextLength: true,
  maxOutputTokens: true,
  minInputPrice: true,
  minOutputPrice: true,
  blendedPrice: true,
  isFree: true,
  isOpenWeights: true,
  providerCount: true,
  lab: { select: { slug: true, name: true } },
  family: { select: { slug: true, name: true } },
  modalities: { select: { direction: true, modality: { select: { slug: true } } } },
  capabilities: { select: { capability: { select: { slug: true } } } },
  score: { select: { overall: true, confidence: true, capability: true, value: true, coding: true } },
  results: { where: { benchmark: { slug: "aa-intelligence-index" } }, select: { score: true }, take: 1 },
} satisfies Prisma.ModelSelect;

type CardRow = Prisma.ModelGetPayload<{ select: typeof modelCardSelect }>;

export function toCard(m: CardRow) {
  return {
    slug: m.slug,
    externalId: m.externalId,
    name: m.name,
    type: m.type,
    status: m.status,
    releasedAt: m.releasedAt?.toISOString() ?? null,
    contextLength: m.contextLength,
    maxOutputTokens: m.maxOutputTokens,
    pricing: { input: num(m.minInputPrice), output: num(m.minOutputPrice), blended: num(m.blendedPrice), isFree: m.isFree },
    isOpenWeights: m.isOpenWeights,
    providerCount: m.providerCount,
    lab: m.lab,
    family: m.family,
    inputModalities: m.modalities.filter((x) => x.direction === "INPUT").map((x) => x.modality.slug),
    outputModalities: m.modalities.filter((x) => x.direction === "OUTPUT").map((x) => x.modality.slug),
    capabilities: m.capabilities.map((x) => x.capability.slug),
    score: m.score ? { overall: m.score.overall, confidence: m.score.confidence, capability: m.score.capability, value: m.score.value, coding: m.score.coding } : null,
    intelligenceIndex: m.results[0]?.score ?? null,
    gridRef: gridRef(num(m.blendedPrice), m.results[0]?.score ?? null),
  };
}
export type ModelCard = ReturnType<typeof toCard>;

export async function listModels(q: ModelListQuery) {
  const where = buildModelWhere(q);
  const [total, rows] = await Promise.all([
    prisma.model.count({ where }),
    prisma.model.findMany({
      where,
      orderBy: buildModelOrder(q.sort, q.order),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: modelCardSelect,
    }),
  ]);
  return { items: rows.map(toCard), total, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(total / q.pageSize)) };
}

/** Facet values with counts for the discovery filter panel (active catalogue). */
export async function getModelFacets() {
  const active = { status: { in: ["ACTIVE", "DEPRECATED"] as ("ACTIVE" | "DEPRECATED")[] } };
  const [labs, providers, types, caps, mods] = await Promise.all([
    prisma.lab.findMany({ select: { slug: true, name: true, _count: { select: { models: { where: active } } } } }),
    prisma.provider.findMany({ where: { offeringCount: { gt: 0 } }, select: { slug: true, name: true, offeringCount: true }, orderBy: { offeringCount: "desc" } }),
    prisma.model.groupBy({ by: ["type"], where: active, _count: true }),
    prisma.capability.findMany({ select: { slug: true, name: true, _count: { select: { models: { where: { model: active } } } } } }),
    prisma.modelModality.groupBy({ by: ["modalityId", "direction"], where: { model: active }, _count: true }),
  ]);
  const modalities = await prisma.modality.findMany();
  const modName = new Map(modalities.map((m) => [m.id, m.slug]));
  return {
    labs: labs.filter((l) => l._count.models > 0).map((l) => ({ value: l.slug, label: l.name, count: l._count.models })).sort((a, b) => b.count - a.count),
    providers: providers.map((p) => ({ value: p.slug, label: p.name, count: p.offeringCount })),
    types: types.map((t) => ({ value: t.type, label: t.type, count: t._count })).sort((a, b) => b.count - a.count),
    capabilities: caps.map((c) => ({ value: c.slug, label: c.name, count: c._count.models })).sort((a, b) => b.count - a.count),
    inputModalities: mods.filter((m) => m.direction === "INPUT").map((m) => ({ value: modName.get(m.modalityId)!, label: modName.get(m.modalityId)!, count: m._count })).sort((a, b) => b.count - a.count),
  };
}

export async function getModel(slug: string) {
  const m = await prisma.model.findUnique({
    where: { slug },
    include: {
      lab: true,
      family: { include: { models: { where: { status: { not: "REMOVED" } }, select: modelCardSelect, orderBy: { releasedAt: "desc" }, take: 12 } } },
      source: true,
      modalities: { include: { modality: true } },
      capabilities: { include: { capability: true } },
      score: true,
      offerings: {
        orderBy: [{ isActive: "desc" }, { providerId: "asc" }],
        include: {
          provider: { select: { slug: true, name: true, headquarters: true, labId: true } },
          prices: { orderBy: [{ minPromptTokens: "asc" }, { component: "asc" }] },
          snapshots: { orderBy: { capturedAt: "asc" } },
        },
      },
      results: { include: { benchmark: { include: { source: true } } }, orderBy: { benchmark: { category: "asc" } } },
      changes: { orderBy: { createdAt: "desc" }, take: 30, include: { job: { select: { id: true, startedAt: true } } } },
    },
  });
  if (!m) return null;

  // trace: recompute dimensions with explanations from the same inputs derive used
  const pop = await loadPopulation(prisma);
  const bench = (s: string) => m.results.find((r) => r.benchmark.slug === s)?.score ?? null;
  const active = m.offerings.filter((o) => o.isActive);
  const uptimes = active.map((o) => o.uptime1d).filter((x): x is number => x != null);
  const trace = scoreModel(
    {
      intelligenceIndex: bench("aa-intelligence-index"),
      codingIndex: bench("aa-coding-index"),
      agenticIndex: bench("aa-agentic-index"),
      codeArenaElo: bench("design-arena-codecategories"),
      blendedPrice: num(m.blendedPrice),
      isFree: m.isFree,
      contextLength: m.contextLength,
      providerCount: active.length,
      bestUptime: uptimes.length ? Math.max(...uptimes) : null,
      inputModalities: m.modalities.filter((x) => x.direction === "INPUT").map((x) => x.modality.slug),
      capabilities: m.capabilities.map((x) => x.capability.slug),
    },
    pop,
  );
  const comp = composite(trace.dimensions, DEFAULT_WEIGHTS);

  // related: same family first, then similar capability-score models from other labs
  const familyIds = new Set((m.family?.models ?? []).map((x) => x.slug));
  const related = m.score?.overall
    ? await prisma.model.findMany({
        where: {
          slug: { notIn: [m.slug, ...familyIds] },
          status: "ACTIVE",
          type: m.type,
          score: { overall: { gte: m.score.overall - 6, lte: m.score.overall + 6 }, confidence: { gte: 0.6 } },
        },
        select: modelCardSelect,
        orderBy: { providerCount: "desc" },
        take: 6,
      })
    : [];

  return {
    id: m.id,
    slug: m.slug,
    externalId: m.externalId,
    canonicalSlug: m.canonicalSlug,
    name: m.name,
    description: m.description,
    type: m.type,
    status: m.status,
    aliasTargetSlug: m.aliasTargetSlug,
    releasedAt: m.releasedAt?.toISOString() ?? null,
    contextLength: m.contextLength,
    maxOutputTokens: m.maxOutputTokens,
    tokenizer: m.tokenizer,
    huggingFaceId: m.huggingFaceId,
    isOpenWeights: m.isOpenWeights,
    knowledgeCutoff: m.knowledgeCutoff,
    expiresAt: m.expiresAt?.toISOString() ?? null,
    reasoningMandatory: m.reasoningMandatory,
    supportedParams: m.supportedParams,
    firstSeenAt: m.firstSeenAt.toISOString(),
    lastSyncedAt: m.lastSyncedAt.toISOString(),
    source: { slug: m.source.slug, name: m.source.name, url: m.source.url, lastSuccessAt: m.source.lastSuccessAt?.toISOString() ?? null },
    lab: { slug: m.lab.slug, name: m.lab.name, website: m.lab.website },
    family: m.family ? { slug: m.family.slug, name: m.family.name, models: m.family.models.map(toCard) } : null,
    inputModalities: m.modalities.filter((x) => x.direction === "INPUT").map((x) => x.modality.slug),
    outputModalities: m.modalities.filter((x) => x.direction === "OUTPUT").map((x) => x.modality.slug),
    capabilities: m.capabilities.map((x) => ({ slug: x.capability.slug, name: x.capability.name, evidence: x.evidence })),
    pricing: { input: num(m.minInputPrice), output: num(m.minOutputPrice), blended: num(m.blendedPrice), isFree: m.isFree },
    offerings: m.offerings.map((o) => ({
      tag: o.tag,
      isActive: o.isActive,
      provider: { slug: o.provider.slug, name: o.provider.name, headquarters: o.provider.headquarters, firstParty: !!o.provider.labId && o.provider.labId === m.labId },
      contextLength: o.contextLength,
      maxOutputTokens: o.maxOutputTokens,
      quantization: o.quantization,
      uptime1d: o.uptime1d,
      sourceStatus: o.sourceStatus,
      supportsImplicitCaching: o.supportsImplicitCaching,
      supportedParams: o.supportedParams,
      lastSeenAt: o.lastSeenAt.toISOString(),
      prices: o.prices.map((p) => ({ component: p.component, unit: p.unit, amount: num(p.amountUsd), isVariable: p.isVariable, minPromptTokens: p.minPromptTokens })),
      history: o.snapshots.map((s) => ({ component: s.component, amount: num(s.amountUsd), at: s.capturedAt.toISOString() })),
    })),
    benchmarks: m.results.map((r) => ({
      slug: r.benchmark.slug,
      name: r.benchmark.name,
      category: r.benchmark.category,
      score: r.score,
      percentile: r.percentile,
      sourceRank: r.sourceRank,
      scaleLabel: r.benchmark.scaleLabel,
      scaleMax: r.benchmark.scaleMax,
      isSynthetic: r.benchmark.isSynthetic,
      observedAt: r.observedAt.toISOString(),
      source: { name: r.benchmark.source.name, url: r.benchmark.source.url },
      methodologyUrl: r.benchmark.methodologyUrl,
    })),
    score: m.score
      ? { overall: comp.overall, confidence: comp.confidence, methodology: m.score.methodology, computedAt: m.score.computedAt.toISOString(), traces: trace.traces, contributions: comp.contributions }
      : null,
    changes: m.changes.map((c) => ({ kind: c.kind, field: c.field, before: c.before, after: c.after, at: c.createdAt.toISOString(), jobId: c.job.id })),
    related: related.map(toCard),
  };
}
export type ModelDetail = NonNullable<Awaited<ReturnType<typeof getModel>>>;
