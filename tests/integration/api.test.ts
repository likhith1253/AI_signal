/**
 * Integration tests: call the real route handlers against the PostgreSQL
 * database in DATABASE_URL (populated by `npm run ingest`). Skipped when the
 * catalogue is empty so `npm test` still works on a fresh clone.
 */
import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { GET as listModels } from "@/app/api/models/route";
import { GET as getModel } from "@/app/api/models/[slug]/route";
import { GET as search } from "@/app/api/search/route";
import { GET as compare } from "@/app/api/compare/route";
import { GET as rankings } from "@/app/api/rankings/route";
import { GET as providers } from "@/app/api/providers/route";
import { GET as labs } from "@/app/api/labs/route";
import { GET as benchmarks } from "@/app/api/benchmarks/route";
import { GET as recommend } from "@/app/api/recommend/route";
import { POST as ingest } from "@/app/api/ingest/route";

// decided at collection time so skipped suites are reported as skipped, not passed
const seeded = process.env.DATABASE_URL ? await prisma.model.count().then((n) => n > 50).catch(() => false) : false;

const req = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, { headers: { "x-forwarded-for": `test-${Math.random()}` }, ...init });
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
type Card = { slug: string; contextLength: number | null; pricing: { input: number | null; blended: number | null; isFree: boolean }; capabilities: string[]; lab: { slug: string } };

describe.runIf(seeded)("API (database-backed)", () => {
  it("GET /api/models paginates with a consistent envelope", async () => {
    const res = await listModels(req("/api/models?pageSize=5&page=2"), undefined as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(5);
    expect(body.meta).toMatchObject({ page: 2, pageSize: 5 });
    expect(body.meta.total).toBeGreaterThan(5);
    expect(res.headers.get("cache-control")).toContain("s-maxage");
  });

  it("filters by capability and context (AND semantics)", async () => {
    const res = await listModels(req("/api/models?capability=tools,vision&minContext=200000&pageSize=50"), undefined as never);
    const { data } = (await res.json()) as { data: Card[] };
    expect(data.length).toBeGreaterThan(0);
    for (const m of data) {
      expect(m.capabilities).toEqual(expect.arrayContaining(["tools", "vision"]));
      expect(m.contextLength).toBeGreaterThanOrEqual(200000);
    }
  });

  it("filters by lab and sorts by input price ascending with unknowns last", async () => {
    const res = await listModels(req("/api/models?lab=openai&sort=input&pageSize=100"), undefined as never);
    const { data } = (await res.json()) as { data: Card[] };
    expect(data.every((m) => m.lab.slug === "openai")).toBe(true);
    const prices = data.map((m) => m.pricing.input);
    const known = prices.filter((p): p is number => p != null);
    expect(known).toEqual([...known].sort((a, b) => a - b));
    const firstNull = prices.indexOf(null);
    if (firstNull >= 0) expect(prices.slice(firstNull).every((p) => p == null)).toBe(true);
  });

  it("price ceiling never admits models with unknown price", async () => {
    const res = await listModels(req("/api/models?maxPrice=0.5&pageSize=100"), undefined as never);
    const { data } = (await res.json()) as { data: Card[] };
    for (const m of data) expect(m.pricing.isFree || (m.pricing.blended != null && m.pricing.blended <= 0.5)).toBe(true);
  });

  it("returns 400 with details for invalid queries", async () => {
    const res = await listModels(req("/api/models?pageSize=9999"), undefined as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.details[0].path).toBe("pageSize");
  });

  it("GET /api/models/:slug returns detail with score trace, and 404 for unknown", async () => {
    const top = await prisma.model.findFirst({ where: { score: { overall: { not: null } } }, select: { slug: true } });
    const res = await getModel(req(`/api/models/${top!.slug}`), params(top!.slug));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.score.traces).toHaveLength(8);
    expect(data.offerings.length).toBeGreaterThan(0);
    expect(data.source.name).toBe("OpenRouter Models API");
    const missing = await getModel(req("/api/models/does-not-exist"), params("does-not-exist"));
    expect(missing.status).toBe(404);
  });

  it("search returns grouped results ranked by name match", async () => {
    const res = await search(req("/api/search?q=claude"), undefined as never);
    const { data } = await res.json();
    expect(data.models.length).toBeGreaterThan(0);
    expect(data.models[0].name.toLowerCase()).toContain("claude");
    expect(data.labs).toBeDefined();
    expect(data.providers).toBeDefined();
  });

  it("compare aligns benchmarks across models and validates input", async () => {
    const two = await prisma.model.findMany({ where: { results: { some: {} } }, take: 2, select: { slug: true } });
    const res = await compare(req(`/api/compare?models=${two.map((t) => t.slug).join(",")},nope`), undefined as never);
    const { data } = await res.json();
    expect(data.models).toHaveLength(2);
    expect(data.missing).toEqual(["nope"]);
    for (const b of data.benchmarks) expect(b.values).toHaveLength(2);
    const bad = await compare(req("/api/compare?models=a,b,c,d,e"), undefined as never);
    expect(bad.status).toBe(400);
  });

  it("rankings label their origin and are ordered", async () => {
    for (const [category, origin] of [
      ["intelligence", "external"],
      ["overall", "derived"],
      ["cheapest", "specification"],
    ] as const) {
      const res = await rankings(req(`/api/rankings?category=${category}&limit=20`), undefined as never);
      const body = await res.json();
      expect(body.meta.origin).toBe(origin);
      const values = body.data.map((r: { value: number }) => r.value);
      const sorted = category === "cheapest" ? [...values].sort((a, b) => a - b) : [...values].sort((a, b) => b - a);
      expect(values).toEqual(sorted);
    }
    const custom = await rankings(req("/api/rankings?category=overall&weights=costEfficiency:1"), undefined as never);
    expect((await custom.json()).meta.weights).toEqual({ costEfficiency: 1 });
  });

  it("directory endpoints keep labs and providers separate", async () => {
    const l = await (await labs(req("/api/labs"), undefined as never)).json();
    const p = await (await providers(req("/api/providers"), undefined as never)).json();
    expect(l.data.find((x: { slug: string }) => x.slug === "anthropic")).toBeTruthy();
    expect(p.data.every((x: { offeringCount: number }) => x.offeringCount > 0)).toBe(true);
  });

  it("benchmarks are traceable to a source", async () => {
    const { data } = await (await benchmarks(req("/api/benchmarks"), undefined as never)).json();
    expect(data.length).toBeGreaterThan(3);
    for (const b of data) {
      expect(b.source.name).toBeTruthy();
      expect(b.isSynthetic).toBe(false);
    }
  });

  it("recommendations honour constraints", async () => {
    const res = await recommend(req("/api/recommend?workload=software-development&maxPrice=1"), undefined as never);
    const { data } = await res.json();
    for (const r of data) {
      expect(r.model.capabilities).toContain("tools");
      expect(r.model.pricing.isFree || r.model.pricing.blended <= 1).toBe(true);
    }
    const unknown = await recommend(req("/api/recommend?workload=nope"), undefined as never);
    expect(unknown.status).toBe(404);
  });

  it("protects the ingestion endpoint", async () => {
    const res = await ingest(req("/api/ingest?plan=1", { method: "POST", headers: { authorization: "Bearer wrong" } }), undefined as never);
    expect([401, 503]).toContain(res.status);
  });
});

describe.runIf(seeded)("data integrity", () => {
  it("no model is duplicated per provider and every offering has a provider", async () => {
    const dupes = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM (SELECT "modelId", tag FROM "Offering" GROUP BY 1, 2 HAVING COUNT(*) > 1) d`;
    expect(Number(dupes[0].n)).toBe(0);
  });

  it("stored aggregates agree with the cheapest active offering", async () => {
    const m = await prisma.model.findFirst({ where: { minInputPrice: { not: null }, providerCount: { gt: 1 } }, include: { offerings: { where: { isActive: true }, include: { prices: { where: { component: "INPUT", minPromptTokens: 0, isVariable: false } } } } } });
    const min = Math.min(...m!.offerings.flatMap((o) => o.prices.map((p) => Number(p.amountUsd))));
    expect(Number(m!.minInputPrice)).toBeCloseTo(min, 6);
  });

  it("percentiles are within [0,1] and models without enough data have no overall score", async () => {
    const bad = await prisma.benchmarkResult.count({ where: { OR: [{ percentile: { lt: 0 } }, { percentile: { gt: 1 } }] } });
    expect(bad).toBe(0);
    const lowConf = await prisma.modelScore.count({ where: { confidence: { lt: 0.6 }, overall: { not: null } } });
    expect(lowConf).toBe(0);
  });
});
