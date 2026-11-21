/**
 * Atlas Engine — staged ingestion pipeline.
 *
 *   fetch → validate → normalize → resolve → diff → commit → derive
 *
 * Every stage is timed and counted; the stage log, counters and validation
 * errors are persisted on the IngestionJob. In `plan` mode the pipeline stops
 * after `diff` and returns the changeset without writing catalogue data.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { mapLimit, openrouter } from "./openrouter/client";
import {
  orEndpointSchema,
  orEndpointsResponseSchema,
  orModelSchema,
  orProviderSchema,
  type OREndpoint,
  type ORModel,
  type ORProvider,
} from "./openrouter/schemas";
import {
  CAPABILITIES,
  classifyModelType,
  cleanDescription,
  deriveCapabilities,
  deriveFamily,
  deriveStatus,
  labKeyFromId,
  MODALITIES,
  modelSlug,
  normalizePricing,
  providerSlugFromTag,
  slugify,
  splitDisplayName,
  type NormalizedPrice,
} from "./normalize";
import { diffCatalog, summarize, type CatalogModel, type Change, type ChangesetSummary } from "./diff";
import { aaBenchmarkRef, arenaBenchmarkRef, DATA_SOURCES, LABS, type BenchmarkRef } from "./reference";
import { deriveAll } from "./derive";

// ─────────────────────────── types ───────────────────────────

export interface NormalizedOffering {
  tag: string;
  providerSlug: string;
  providerName: string;
  contextLength: number | null;
  maxOutputTokens: number | null;
  maxPromptTokens: number | null;
  quantization: string | null;
  sourceStatus: number | null;
  uptime1d: number | null;
  supportsImplicitCaching: boolean;
  supportedParams: string[];
  prices: NormalizedPrice[];
}

export interface NormalizedBenchmark {
  ref: BenchmarkRef;
  score: number;
  sourceRank: number | null;
  extra: Record<string, unknown> | null;
}

export interface NormalizedModel extends CatalogModel {
  slug: string;
  canonicalSlug: string | null;
  name: string;
  labKey: string;
  labPrefix: string | null;
  family: string | null;
  description: string | null;
  type: ReturnType<typeof classifyModelType>;
  status: ReturnType<typeof deriveStatus>;
  aliasTargetSlug: string | null;
  releasedAt: Date;
  tokenizer: string | null;
  huggingFaceId: string | null;
  knowledgeCutoff: string | null;
  expiresAt: Date | null;
  reasoningMandatory: boolean;
  supportedParams: string[];
  capabilities: { slug: string; evidence: string }[];
  offerings: NormalizedOffering[];
  benchmarkList: NormalizedBenchmark[];
}

export interface StageLog {
  stage: string;
  ms: number;
  in: number;
  out: number;
  note?: string;
}

export interface IngestOptions {
  plan?: boolean; // dry run
  trigger?: string;
  /** cap endpoint lookups (useful for serverless time limits); default all */
  endpointLimit?: number;
  concurrency?: number;
  log?: (msg: string) => void;
}

export interface IngestResult {
  jobId: string | null;
  plan: boolean;
  baseline: boolean;
  summary: ChangesetSummary;
  changes: Change[];
  stages: StageLog[];
  errors: { ref: string; message: string }[];
}

// ─────────────────────────── stage runner ───────────────────────────

class Stages {
  logs: StageLog[] = [];
  constructor(private log: (m: string) => void) {}
  async run<T>(stage: string, inCount: number, fn: () => Promise<T> | T, outCount: (r: T) => number, note?: (r: T) => string) {
    const t0 = performance.now();
    const r = await fn();
    const entry: StageLog = { stage, ms: Math.round(performance.now() - t0), in: inCount, out: outCount(r), note: note?.(r) };
    this.logs.push(entry);
    this.log(`  ${stage.padEnd(10)} ${String(entry.in).padStart(5)} → ${String(entry.out).padEnd(5)} ${String(entry.ms).padStart(6)}ms ${entry.note ?? ""}`);
    return r;
  }
}

// ─────────────────────────── normalize ───────────────────────────

function normalizeEndpoint(e: OREndpoint): NormalizedOffering {
  const providerSlug = providerSlugFromTag(e.tag, e.provider_name);
  return {
    tag: (e.tag ?? providerSlug).toLowerCase(),
    providerSlug,
    providerName: e.provider_name,
    contextLength: e.context_length ?? null,
    maxOutputTokens: e.max_completion_tokens ?? null,
    maxPromptTokens: e.max_prompt_tokens ?? null,
    quantization: e.quantization && e.quantization !== "unknown" ? e.quantization : null,
    sourceStatus: e.status ?? null,
    uptime1d: e.uptime_last_1d ?? null,
    supportsImplicitCaching: !!e.supports_implicit_caching,
    supportedParams: e.supported_parameters ?? [],
    prices: normalizePricing(e.pricing),
  };
}

/** When per-provider endpoints are unavailable, fall back to OpenRouter's aggregate listing. */
function aggregateOffering(m: ORModel): NormalizedOffering {
  return {
    tag: "openrouter",
    providerSlug: "openrouter",
    providerName: "OpenRouter",
    contextLength: m.top_provider?.context_length ?? m.context_length ?? null,
    maxOutputTokens: m.top_provider?.max_completion_tokens ?? null,
    maxPromptTokens: null,
    quantization: null,
    sourceStatus: null,
    uptime1d: null,
    supportsImplicitCaching: false,
    supportedParams: m.supported_parameters ?? [],
    prices: normalizePricing(m.pricing),
  };
}

export function normalizeModel(m: ORModel, endpoints: OREndpoint[] | null): NormalizedModel {
  const { prefix, name } = splitDisplayName(m.name);
  const benchmarkList: NormalizedBenchmark[] = [];
  const aa = m.benchmarks?.artificial_analysis;
  if (aa) {
    for (const [key, val] of Object.entries(aa)) {
      if (typeof val === "number" && Number.isFinite(val)) benchmarkList.push({ ref: aaBenchmarkRef(key), score: val, sourceRank: null, extra: null });
    }
  }
  const seenArena = new Set<string>();
  for (const e of m.benchmarks?.design_arena ?? []) {
    const ref = arenaBenchmarkRef(e.arena, e.category);
    if (seenArena.has(ref.slug)) continue;
    seenArena.add(ref.slug);
    benchmarkList.push({ ref, score: e.elo, sourceRank: e.rank ?? null, extra: e.win_rate != null ? { winRate: e.win_rate } : null });
  }

  const status = deriveStatus(m);
  let offerings: NormalizedOffering[] = [];
  if (status !== "ALIAS") {
    offerings = endpoints && endpoints.length ? endpoints.map(normalizeEndpoint) : [aggregateOffering(m)];
    // dedupe tags defensively (source occasionally repeats an endpoint)
    offerings = [...new Map(offerings.map((o) => [o.tag, o])).values()];
  }

  return {
    externalId: m.id,
    slug: modelSlug(m.id),
    canonicalSlug: m.canonical_slug ?? null,
    name,
    labKey: labKeyFromId(m.id),
    labPrefix: prefix,
    family: deriveFamily(name),
    description: cleanDescription(m.description),
    type: classifyModelType(m),
    status,
    aliasTargetSlug: m.alias_target?.slug ?? null,
    releasedAt: new Date(m.created * 1000),
    contextLength: m.context_length ?? null,
    maxOutputTokens: m.top_provider?.max_completion_tokens ?? null,
    tokenizer: m.architecture.tokenizer ?? null,
    huggingFaceId: m.hugging_face_id || null,
    knowledgeCutoff: m.knowledge_cutoff ?? null,
    expiresAt: m.expiration_date ? new Date(m.expiration_date) : null,
    reasoningMandatory: !!m.reasoning?.mandatory,
    supportedParams: m.supported_parameters ?? [],
    inputModalities: (m.architecture.input_modalities ?? []).filter((x) => (MODALITIES as readonly string[]).includes(x)),
    outputModalities: (m.architecture.output_modalities ?? []).filter((x) => (MODALITIES as readonly string[]).includes(x)),
    capabilities: deriveCapabilities(m),
    offerings,
    benchmarkList,
    benchmarks: Object.fromEntries(benchmarkList.map((b) => [b.ref.slug, b.score])),
  };
}

// ─────────────────────────── snapshot of stored catalogue ───────────────────────────

async function loadCatalog(db: PrismaClient): Promise<Map<string, CatalogModel>> {
  const rows = await db.model.findMany({
    select: {
      externalId: true,
      contextLength: true,
      maxOutputTokens: true,
      status: true,
      modalities: { select: { direction: true, modality: { select: { slug: true } } } },
      offerings: { where: { isActive: true }, select: { tag: true, prices: true } },
      results: { select: { score: true, benchmark: { select: { slug: true } } } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.externalId,
      {
        externalId: r.externalId,
        contextLength: r.contextLength,
        maxOutputTokens: r.maxOutputTokens,
        status: r.status,
        inputModalities: r.modalities.filter((x) => x.direction === "INPUT").map((x) => x.modality.slug),
        outputModalities: r.modalities.filter((x) => x.direction === "OUTPUT").map((x) => x.modality.slug),
        offerings: r.offerings.map((o) => ({
          tag: o.tag,
          prices: o.prices.map((p) => ({
            component: p.component,
            unit: p.unit,
            amountUsd: p.amountUsd == null ? null : Number(p.amountUsd),
            isVariable: p.isVariable,
            minPromptTokens: p.minPromptTokens,
          })),
        })),
        benchmarks: Object.fromEntries(r.results.map((b) => [b.benchmark.slug, b.score])),
      },
    ]),
  );
}

// ─────────────────────────── main ───────────────────────────

export async function runIngest(db: PrismaClient, opts: IngestOptions = {}): Promise<IngestResult> {
  const log = opts.log ?? (() => {});
  const stages = new Stages(log);
  const errors: { ref: string; message: string }[] = [];
  const concurrency = opts.concurrency ?? 6;
  const plan = !!opts.plan;

  // reference rows must exist before a job can point at its source
  await ensureReference(db);
  const source = await db.dataSource.findUniqueOrThrow({ where: { slug: "openrouter" } });
  const job = await db.ingestionJob.create({ data: { sourceId: source.id, trigger: opts.trigger ?? "cli", dryRun: plan } });

  try {
    // 1. fetch ───────────────────────────
    const raw = await stages.run(
      "fetch",
      0,
      async () => {
        const [modelsRes, providersRes] = await Promise.all([openrouter.models(), openrouter.providers()]);
        const models = ((modelsRes as { data?: unknown[] }).data ?? []) as unknown[];
        const providers = ((providersRes as { data?: unknown[] }).data ?? []) as unknown[];
        return { models, providers };
      },
      (r) => r.models.length,
      (r) => `${r.providers.length} providers`,
    );

    // 2. validate ───────────────────────────
    const valid = await stages.run(
      "validate",
      raw.models.length,
      () => {
        const models: ORModel[] = [];
        for (const item of raw.models) {
          const p = orModelSchema.safeParse(item);
          if (p.success) models.push(p.data);
          else errors.push({ ref: String((item as { id?: unknown })?.id ?? "unknown"), message: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        }
        const providers: ORProvider[] = [];
        for (const item of raw.providers) {
          const p = orProviderSchema.safeParse(item);
          if (p.success) providers.push(p.data);
        }
        return { models, providers };
      },
      (r) => r.models.length,
      (r) => `${raw.models.length - r.models.length} rejected`,
    );

    // 2b. fetch per-provider endpoints (bounded concurrency) ───────────────────────────
    const endpointTargets = valid.models.filter((m) => !m.alias_target).slice(0, opts.endpointLimit ?? Infinity);
    const endpointMap = await stages.run(
      "endpoints",
      endpointTargets.length,
      async () => {
        const map = new Map<string, OREndpoint[]>();
        let done = 0;
        await mapLimit(endpointTargets, concurrency, async (m) => {
          try {
            const res = orEndpointsResponseSchema.parse(await openrouter.endpoints(m.id));
            const eps: OREndpoint[] = [];
            for (const e of res.data.endpoints) {
              const p = orEndpointSchema.safeParse(e);
              if (p.success) eps.push(p.data);
              else errors.push({ ref: `${m.id}#endpoint`, message: p.error.issues[0]?.message ?? "invalid endpoint" });
            }
            map.set(m.id, eps);
          } catch (err) {
            errors.push({ ref: `${m.id}#endpoints`, message: (err as Error).message });
          }
          if (++done % 50 === 0) log(`             … ${done}/${endpointTargets.length} endpoint lists`);
        });
        return map;
      },
      (r) => r.size,
      (r) => `${[...r.values()].reduce((s, e) => s + e.length, 0)} provider offerings`,
    );

    // 3. normalize ───────────────────────────
    const normalized = await stages.run(
      "normalize",
      valid.models.length,
      () => valid.models.map((m) => normalizeModel(m, endpointMap.get(m.id) ?? null)),
      (r) => r.length,
    );

    // 4. resolve identity: dedupe by slug (first wins), detect collisions ───────────────────────────
    const resolved = await stages.run(
      "resolve",
      normalized.length,
      () => {
        const bySlug = new Map<string, NormalizedModel>();
        for (const m of normalized) {
          const existing = bySlug.get(m.slug);
          if (existing) {
            errors.push({ ref: m.externalId, message: `slug collision with ${existing.externalId}; skipped` });
            continue;
          }
          bySlug.set(m.slug, m);
        }
        return [...bySlug.values()];
      },
      (r) => r.length,
      (r) => `${new Set(r.map((m) => m.labKey)).size} labs, ${new Set(r.flatMap((m) => m.offerings.map((o) => o.providerSlug))).size} providers`,
    );

    // 5. diff ───────────────────────────
    const prev = await loadCatalog(db);
    const baseline = prev.size === 0;
    const changes = await stages.run(
      "diff",
      resolved.length,
      () => diffCatalog(prev, resolved),
      (r) => r.length,
      () => (baseline ? "baseline run — no prior catalogue" : "changes vs stored catalogue"),
    );
    const summary = summarize(changes, resolved.length);

    if (plan) {
      await db.ingestionJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", finishedAt: new Date(), stats: { ...summary, fetched: raw.models.length }, errors: errors.slice(0, 200), stages: stages.logs as unknown as Prisma.InputJsonValue, isBaseline: baseline },
      });
      return { jobId: job.id, plan, baseline, summary, changes, stages: stages.logs, errors };
    }

    // 6. commit ───────────────────────────
    await stages.run(
      "commit",
      resolved.length,
      () => commit(db, { resolved, prev, providers: valid.providers, changes, baseline, jobId: job.id, sourceId: source.id, concurrency, errors }),
      () => resolved.length,
      () => (baseline ? "baseline: ledger not written" : `${changes.length} ledger events`),
    );

    // 7. derive ───────────────────────────
    await stages.run("derive", resolved.length, () => deriveAll(db), (r) => r.scored, (r) => `${r.percentiles} percentiles, ${r.scored} scores`);

    await db.dataSource.update({ where: { id: source.id }, data: { lastSuccessAt: new Date() } });
    await db.dataSource.updateMany({ where: { slug: { in: ["artificial-analysis", "design-arena", "oneatlas-derived"] } }, data: { lastSuccessAt: new Date() } });

    const status = errors.length ? "PARTIAL" : "SUCCEEDED";
    await db.ingestionJob.update({
      where: { id: job.id },
      data: {
        status,
        finishedAt: new Date(),
        isBaseline: baseline,
        stats: { ...summary, fetched: raw.models.length, valid: valid.models.length, offerings: resolved.reduce((s, m) => s + m.offerings.length, 0) },
        errors: errors.slice(0, 200),
        stages: stages.logs as unknown as Prisma.InputJsonValue,
      },
    });
    return { jobId: job.id, plan, baseline, summary, changes, stages: stages.logs, errors };
  } catch (err) {
    await db.ingestionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", finishedAt: new Date(), errors: [...errors.slice(0, 199), { ref: "pipeline", message: (err as Error).message }], stages: stages.logs as unknown as Prisma.InputJsonValue },
    });
    throw err;
  }
}

// ─────────────────────────── reference data ───────────────────────────

export async function ensureReference(db: PrismaClient) {
  for (const s of DATA_SOURCES) {
    await db.dataSource.upsert({ where: { slug: s.slug }, create: s, update: { name: s.name, url: s.url, kind: s.kind, description: s.description, termsNote: s.termsNote } });
  }
  for (const slug of MODALITIES) {
    await db.modality.upsert({ where: { slug }, create: { slug, name: slug[0].toUpperCase() + slug.slice(1) }, update: {} });
  }
  for (const c of CAPABILITIES) {
    await db.capability.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name, description: c.description } });
  }
  for (const l of LABS) {
    const data = { name: l.name, website: l.website, headquarters: l.headquarters, foundedYear: l.foundedYear, description: l.description, isCurated: true };
    await db.lab.upsert({ where: { slug: slugify(l.key) }, create: { slug: slugify(l.key), ...data }, update: data });
  }
}

// ─────────────────────────── commit ───────────────────────────

interface CommitCtx {
  resolved: NormalizedModel[];
  prev: Map<string, CatalogModel>;
  providers: ORProvider[];
  changes: Change[];
  baseline: boolean;
  jobId: string;
  sourceId: string;
  concurrency: number;
  errors: { ref: string; message: string }[];
}

function websiteFromUrl(u: string | null | undefined) {
  if (!u) return null;
  try {
    return `https://${new URL(u).hostname.replace(/^(www\.|platform\.|docs\.)/, "")}`;
  } catch {
    return null;
  }
}

async function commit(db: PrismaClient, ctx: CommitCtx) {
  const { resolved } = ctx;

  // labs: curated ones exist; create inferred labs for the rest
  const labIds = new Map<string, string>();
  for (const l of await db.lab.findMany({ select: { id: true, slug: true } })) labIds.set(l.slug, l.id);
  for (const m of resolved) {
    const slug = slugify(m.labKey);
    if (labIds.has(slug)) continue;
    const name = m.labPrefix ?? m.labKey.replace(/(^|-)\w/g, (s) => s.replace("-", " ").toUpperCase());
    const lab = await db.lab.create({ data: { slug, name, isCurated: false } });
    labIds.set(slug, lab.id);
  }

  // providers: directory + any seen on endpoints
  const firstParty = new Map<string, string>();
  for (const l of LABS) for (const p of l.firstPartyProviders ?? []) firstParty.set(p, slugify(l.key));
  const providerIds = new Map<string, string>();
  const dir = new Map(ctx.providers.map((p) => [p.slug.toLowerCase(), p]));
  const seenProviders = new Map<string, string>();
  for (const m of resolved) for (const o of m.offerings) seenProviders.set(o.providerSlug, o.providerName);
  for (const slug of new Set([...dir.keys(), ...seenProviders.keys()])) {
    const d = dir.get(slug);
    const labSlug = firstParty.get(slug);
    const data = {
      name: d?.name ?? seenProviders.get(slug) ?? slug,
      headquarters: d?.headquarters ?? null,
      datacenters: d?.datacenters ?? [],
      privacyPolicyUrl: d?.privacy_policy_url ?? null,
      termsUrl: d?.terms_of_service_url ?? null,
      statusPageUrl: d?.status_page_url ?? null,
      website: slug === "openrouter" ? "https://openrouter.ai" : websiteFromUrl(d?.terms_of_service_url ?? d?.privacy_policy_url),
      labId: labSlug ? labIds.get(labSlug) ?? null : null,
    };
    const p = await db.provider.upsert({ where: { slug }, create: { slug, ...data }, update: data, select: { id: true } });
    providerIds.set(slug, p.id);
  }

  // families — identity is the slug, so "GPT" and "Gpt" resolve to one family
  const familyIds = new Map<string, string>();
  const familySlug = (labKey: string, family: string) => `${slugify(labKey)}-${slugify(family)}`;
  for (const f of await db.modelFamily.findMany({ select: { id: true, slug: true } })) familyIds.set(f.slug, f.id);
  for (const m of resolved) {
    if (!m.family) continue;
    const slug = familySlug(m.labKey, m.family);
    if (familyIds.has(slug)) continue;
    const labId = labIds.get(slugify(m.labKey))!;
    const f = await db.modelFamily.upsert({ where: { slug }, create: { labId, name: m.family, slug }, update: {}, select: { id: true } });
    familyIds.set(slug, f.id);
  }

  // benchmarks registry
  const benchmarkIds = new Map<string, string>();
  const sources = new Map((await db.dataSource.findMany()).map((s) => [s.slug, s.id]));
  const refs = new Map<string, BenchmarkRef>();
  for (const m of resolved) for (const b of m.benchmarkList) refs.set(b.ref.slug, b.ref);
  for (const r of refs.values()) {
    const data = { name: r.name, category: r.category, description: r.description, scaleMin: r.scaleMin, scaleMax: r.scaleMax, scaleLabel: r.scaleLabel, methodologyUrl: r.methodologyUrl, sourceId: sources.get(r.sourceSlug)! };
    const b = await db.benchmark.upsert({ where: { slug: r.slug }, create: { slug: r.slug, ...data }, update: data, select: { id: true } });
    benchmarkIds.set(r.slug, b.id);
  }

  const modalityIds = new Map((await db.modality.findMany()).map((x) => [x.slug, x.id]));
  const capabilityIds = new Map((await db.capability.findMany()).map((x) => [x.slug, x.id]));
  const now = new Date();
  const modelIds = new Map<string, string>();

  await mapLimit(resolved, ctx.concurrency, async (m) => {
    try {
      const labId = labIds.get(slugify(m.labKey))!;
      const data = {
        slug: m.slug,
        canonicalSlug: m.canonicalSlug,
        name: m.name,
        description: m.description,
        labId,
        familyId: m.family ? familyIds.get(familySlug(m.labKey, m.family)) ?? null : null,
        type: m.type,
        status: m.status,
        aliasTargetSlug: m.aliasTargetSlug ? modelSlug(m.aliasTargetSlug) : null,
        releasedAt: m.releasedAt,
        contextLength: m.contextLength,
        maxOutputTokens: m.maxOutputTokens,
        tokenizer: m.tokenizer,
        huggingFaceId: m.huggingFaceId,
        isOpenWeights: !!m.huggingFaceId,
        knowledgeCutoff: m.knowledgeCutoff,
        expiresAt: m.expiresAt,
        reasoningMandatory: m.reasoningMandatory,
        supportedParams: m.supportedParams,
        sourceId: ctx.sourceId,
        lastSyncedAt: now,
      };
      const model = await db.model.upsert({ where: { externalId: m.externalId }, create: { externalId: m.externalId, ...data }, update: data, select: { id: true } });
      modelIds.set(m.externalId, model.id);

      await db.$transaction([
        db.modelModality.deleteMany({ where: { modelId: model.id } }),
        db.modelModality.createMany({
          data: [
            ...m.inputModalities.map((s) => ({ modelId: model.id, modalityId: modalityIds.get(s)!, direction: "INPUT" as const })),
            ...m.outputModalities.map((s) => ({ modelId: model.id, modalityId: modalityIds.get(s)!, direction: "OUTPUT" as const })),
          ],
          skipDuplicates: true,
        }),
        db.modelCapability.deleteMany({ where: { modelId: model.id } }),
        db.modelCapability.createMany({ data: m.capabilities.map((c) => ({ modelId: model.id, capabilityId: capabilityIds.get(c.slug)!, evidence: c.evidence })), skipDuplicates: true }),
        db.benchmarkResult.deleteMany({ where: { modelId: model.id } }),
        db.benchmarkResult.createMany({
          data: m.benchmarkList.map((b) => ({
            benchmarkId: benchmarkIds.get(b.ref.slug)!,
            modelId: model.id,
            score: b.score,
            sourceRank: b.sourceRank,
            extra: (b.extra ?? undefined) as Prisma.InputJsonValue | undefined,
            observedAt: now,
            sourceId: sources.get(b.ref.sourceSlug)!,
          })),
          skipDuplicates: true,
        }),
      ]);

      // offerings + prices
      const prevOfferings = new Map((ctx.prev.get(m.externalId)?.offerings ?? []).map((o) => [o.tag, o]));
      const activeTags: string[] = [];
      for (const o of m.offerings) {
        activeTags.push(o.tag);
        const odata = {
          providerId: providerIds.get(o.providerSlug)!,
          contextLength: o.contextLength,
          maxOutputTokens: o.maxOutputTokens,
          maxPromptTokens: o.maxPromptTokens,
          quantization: o.quantization,
          sourceStatus: o.sourceStatus,
          uptime1d: o.uptime1d,
          supportsImplicitCaching: o.supportsImplicitCaching,
          supportedParams: o.supportedParams,
          isActive: true,
          lastSeenAt: now,
        };
        const off = await db.offering.upsert({
          where: { modelId_tag: { modelId: model.id, tag: o.tag } },
          create: { modelId: model.id, tag: o.tag, ...odata },
          update: odata,
          select: { id: true },
        });
        // history: snapshot every price observed for the first time or changed
        const before = new Map((prevOfferings.get(o.tag)?.prices ?? []).map((p) => [`${p.component}@${p.minPromptTokens}`, p]));
        const snapshots = o.prices
          .filter((p) => p.minPromptTokens === 0)
          .filter((p) => {
            const b = before.get(`${p.component}@0`);
            return !b || b.amountUsd !== p.amountUsd || b.isVariable !== p.isVariable;
          })
          .map((p) => ({ offeringId: off.id, component: p.component, amountUsd: p.amountUsd, capturedAt: now }));
        await db.$transaction([
          db.price.deleteMany({ where: { offeringId: off.id } }),
          db.price.createMany({
            data: o.prices.map((p) => ({ offeringId: off.id, component: p.component, unit: p.unit, amountUsd: p.amountUsd, isVariable: p.isVariable, minPromptTokens: p.minPromptTokens })),
            skipDuplicates: true,
          }),
          db.priceSnapshot.createMany({ data: snapshots }),
        ]);
      }
      await db.offering.updateMany({ where: { modelId: model.id, tag: { notIn: activeTags } }, data: { isActive: false } });
    } catch (err) {
      ctx.errors.push({ ref: m.externalId, message: `commit: ${(err as Error).message.slice(0, 300)}` });
    }
  });

  // models no longer listed at the source
  const listed = resolved.map((m) => m.externalId);
  const gone = await db.model.findMany({ where: { externalId: { notIn: listed }, status: { not: "REMOVED" } }, select: { id: true } });
  if (gone.length) {
    await db.model.updateMany({ where: { id: { in: gone.map((g) => g.id) } }, data: { status: "REMOVED" } });
    await db.offering.updateMany({ where: { modelId: { in: gone.map((g) => g.id) } }, data: { isActive: false } });
  }

  // ledger
  if (!ctx.baseline && ctx.changes.length) {
    const ids = new Map((await db.model.findMany({ where: { externalId: { in: [...new Set(ctx.changes.map((c) => c.subject))] } }, select: { id: true, externalId: true } })).map((x) => [x.externalId, x.id]));
    const rows = ctx.changes.map((c) => ({
      jobId: ctx.jobId,
      kind: c.kind,
      subject: c.subject,
      modelId: ids.get(c.subject) ?? null,
      field: c.field ?? null,
      before: (c.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (c.after ?? undefined) as Prisma.InputJsonValue | undefined,
    }));
    for (let i = 0; i < rows.length; i += 500) await db.changeEvent.createMany({ data: rows.slice(i, i + 500) });
  }
}
