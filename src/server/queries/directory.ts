/** Labs (model developers) and Providers (API hosts) — deliberately separate entities. */
import { prisma } from "../db/client";
import { modelCardSelect, toCard } from "./models";
import { median, num } from "./util";

const ACTIVE = { status: { in: ["ACTIVE", "DEPRECATED"] as ("ACTIVE" | "DEPRECATED")[] } };

// ─────────────────────────── labs ───────────────────────────

export async function listLabs() {
  const labs = await prisma.lab.findMany({
    include: {
      _count: { select: { models: { where: ACTIVE }, families: true } },
      models: { where: ACTIVE, select: { releasedAt: true, isOpenWeights: true, score: { select: { overall: true } } }, orderBy: { releasedAt: "desc" } },
      providers: { select: { slug: true, name: true } },
    },
  });
  return labs
    .filter((l) => l._count.models > 0)
    .map((l) => {
      const scores = l.models.map((m) => m.score?.overall).filter((x): x is number => x != null);
      return {
        slug: l.slug,
        name: l.name,
        description: l.description,
        website: l.website,
        headquarters: l.headquarters,
        foundedYear: l.foundedYear,
        isCurated: l.isCurated,
        modelCount: l._count.models,
        familyCount: l._count.families,
        openWeightsCount: l.models.filter((m) => m.isOpenWeights).length,
        latestRelease: l.models[0]?.releasedAt?.toISOString() ?? null,
        topScore: scores.length ? Math.max(...scores) : null,
        firstPartyProviders: l.providers,
      };
    })
    .sort((a, b) => Number(b.isCurated) - Number(a.isCurated) || b.modelCount - a.modelCount);
}

export async function getLab(slug: string) {
  const lab = await prisma.lab.findUnique({
    where: { slug },
    include: {
      providers: { select: { slug: true, name: true } },
      families: { include: { _count: { select: { models: { where: ACTIVE } } } }, orderBy: { name: "asc" } },
    },
  });
  if (!lab) return null;
  const models = await prisma.model.findMany({ where: { labId: lab.id, ...ACTIVE }, select: modelCardSelect, orderBy: { releasedAt: "desc" } });
  // which third-party providers serve this lab's models
  const servedBy = await prisma.offering.groupBy({ by: ["providerId"], where: { isActive: true, model: { labId: lab.id, ...ACTIVE } }, _count: true, orderBy: { _count: { providerId: "desc" } } });
  const provs = await prisma.provider.findMany({ where: { id: { in: servedBy.map((s) => s.providerId) } }, select: { id: true, slug: true, name: true } });
  const pmap = new Map(provs.map((p) => [p.id, p]));
  return {
    slug: lab.slug,
    name: lab.name,
    description: lab.description,
    website: lab.website,
    headquarters: lab.headquarters,
    foundedYear: lab.foundedYear,
    isCurated: lab.isCurated,
    firstPartyProviders: lab.providers,
    families: lab.families.filter((f) => f._count.models > 0).map((f) => ({ slug: f.slug, name: f.name, modelCount: f._count.models })),
    models: models.map(toCard),
    servedBy: servedBy.map((s) => ({ ...pmap.get(s.providerId)!, offerings: s._count })),
  };
}

// ─────────────────────────── providers ───────────────────────────

export async function listProviders() {
  const providers = await prisma.provider.findMany({
    where: { offeringCount: { gt: 0 } },
    include: {
      lab: { select: { slug: true, name: true } },
      offerings: {
        where: { isActive: true, model: ACTIVE },
        select: { quantization: true, uptime1d: true, model: { select: { labId: true } }, prices: { where: { component: { in: ["INPUT", "OUTPUT"] }, minPromptTokens: 0 } } },
      },
    },
    orderBy: { offeringCount: "desc" },
  });
  return providers.map((p) => {
    const inputs = p.offerings.flatMap((o) => o.prices.filter((x) => x.component === "INPUT").map((x) => num(x.amountUsd))).filter((x): x is number => x != null);
    const uptimes = p.offerings.map((o) => o.uptime1d).filter((x): x is number => x != null);
    return {
      slug: p.slug,
      name: p.name,
      website: p.website,
      headquarters: p.headquarters,
      datacenters: p.datacenters,
      firstPartyOf: p.lab,
      offeringCount: p.offerings.length,
      labCount: new Set(p.offerings.map((o) => o.model.labId)).size,
      medianInputPrice: median(inputs),
      medianUptime: median(uptimes),
      quantizations: [...new Set(p.offerings.map((o) => o.quantization).filter(Boolean))] as string[],
    };
  });
}

export async function getProvider(slug: string) {
  const p = await prisma.provider.findUnique({ where: { slug }, include: { lab: { select: { slug: true, name: true } } } });
  if (!p) return null;
  const offerings = await prisma.offering.findMany({
    where: { providerId: p.id, isActive: true, model: ACTIVE },
    include: {
      prices: { where: { minPromptTokens: 0 } },
      model: { select: { ...modelCardSelect, id: true } },
    },
  });
  // how does this provider's price compare with the cheapest available elsewhere?
  const modelIds = offerings.map((o) => o.model.id);
  const others = await prisma.price.findMany({
    where: { component: "INPUT", minPromptTokens: 0, isVariable: false, offering: { isActive: true, modelId: { in: modelIds }, providerId: { not: p.id } } },
    select: { amountUsd: true, offering: { select: { modelId: true } } },
  });
  const cheapestElsewhere = new Map<string, number>();
  for (const o of others) {
    const v = num(o.amountUsd);
    if (v == null) continue;
    const cur = cheapestElsewhere.get(o.offering.modelId);
    if (cur == null || v < cur) cheapestElsewhere.set(o.offering.modelId, v);
  }
  const rows = offerings
    .map((o) => {
      const price = (c: string) => {
        const x = o.prices.find((pp) => pp.component === c);
        return x ? (x.isVariable ? null : num(x.amountUsd)) : null;
      };
      const input = price("INPUT");
      const elsewhere = cheapestElsewhere.get(o.model.id) ?? null;
      return {
        tag: o.tag,
        model: toCard(o.model),
        contextLength: o.contextLength,
        maxOutputTokens: o.maxOutputTokens,
        quantization: o.quantization,
        uptime1d: o.uptime1d,
        input,
        output: price("OUTPUT"),
        cacheRead: price("CACHE_READ"),
        cheapestElsewhere: elsewhere,
        /** positive = this provider is more expensive than the cheapest alternative */
        premiumPct: input != null && elsewhere != null && elsewhere > 0 ? Math.round(((input - elsewhere) / elsewhere) * 100) : null,
      };
    })
    .sort((a, b) => (b.model.score?.overall ?? -1) - (a.model.score?.overall ?? -1));
  return {
    slug: p.slug,
    name: p.name,
    website: p.website,
    headquarters: p.headquarters,
    datacenters: p.datacenters,
    privacyPolicyUrl: p.privacyPolicyUrl,
    termsUrl: p.termsUrl,
    statusPageUrl: p.statusPageUrl,
    firstPartyOf: p.lab,
    offerings: rows,
    stats: {
      offerings: rows.length,
      labs: new Set(rows.map((r) => r.model.lab.slug)).size,
      cheapestCount: rows.filter((r) => r.input != null && (r.cheapestElsewhere == null || r.input <= r.cheapestElsewhere)).length,
      medianUptime: median(rows.map((r) => r.uptime1d).filter((x): x is number => x != null)),
    },
  };
}
