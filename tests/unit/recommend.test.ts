import { describe, expect, it } from "vitest";
import { getWorkload, meetsRequirements, recommend, type Candidate } from "@/server/recommend/workloads";
import { paretoFrontier, frontierGap } from "@/lib/frontier";

const dims = (o: Partial<Candidate["dimensions"]> = {}): Candidate["dimensions"] => ({
  capability: 50,
  coding: 50,
  agentic: 50,
  costEfficiency: 50,
  value: 50,
  context: 50,
  availability: 50,
  versatility: 50,
  ...o,
});

const cand = (slug: string, o: Partial<Candidate> = {}): Candidate => ({
  slug,
  name: slug,
  type: "CHAT",
  contextLength: 128000,
  blendedPrice: 1,
  isFree: false,
  isOpenWeights: false,
  capabilities: ["tools"],
  providerCount: 3,
  dimensions: dims(),
  ...o,
});

describe("workload requirements", () => {
  const coding = getWorkload("software-development")!;
  it("enforces capabilities, types, context and price constraints", () => {
    expect(meetsRequirements(cand("a"), coding)).toBe(true);
    expect(meetsRequirements(cand("a", { capabilities: [] }), coding)).toBe(false);
    expect(meetsRequirements(cand("a", { type: "EMBEDDING" }), coding)).toBe(false);
    expect(meetsRequirements(cand("a"), coding, { maxBlendedPrice: 0.5 })).toBe(false);
    expect(meetsRequirements(cand("a", { isFree: true, blendedPrice: 0 }), coding, { maxBlendedPrice: 0.5 })).toBe(true);
    expect(meetsRequirements(cand("a", { blendedPrice: null }), coding, { maxBlendedPrice: 5 })).toBe(false); // unknown price never passes a ceiling
    expect(meetsRequirements(cand("a"), coding, { openWeightsOnly: true })).toBe(false);
    expect(meetsRequirements(cand("a", { contextLength: 100_000 }), getWorkload("long-context")!)).toBe(false);
  });
  it("returns null for unknown workloads", () => {
    expect(getWorkload("nope")).toBeNull();
  });
});

describe("recommend", () => {
  const coding = getWorkload("software-development")!;
  it("ranks by the workload weights and explains picks deterministically", () => {
    const list = [cand("generalist", { dimensions: dims({ capability: 90, coding: 40 }) }), cand("coder", { dimensions: dims({ coding: 95, capability: 70 }) }), cand("no-tools", { capabilities: [], dimensions: dims({ coding: 99 }) })];
    const r = recommend(list, coding);
    expect(r.map((x) => x.slug)).toEqual(["coder", "generalist"]);
    expect(r[0].reasons.some((x) => x.startsWith("Coding benchmarks"))).toBe(true);
    expect(recommend(list, coding)).toEqual(r);
  });

  it("prefers complete data over equal scores with gaps", () => {
    const full = cand("full", { dimensions: dims({ coding: 70, capability: 70, value: 70, context: 70, availability: 70 }) });
    const gappy = cand("gappy", { dimensions: dims({ coding: 70, capability: 70, value: null, context: 70, availability: 70 }) });
    expect(recommend([gappy, full], coding).map((x) => x.slug)).toEqual(["full", "gappy"]);
  });

  it("adds caveats for single-provider models", () => {
    const r = recommend([cand("solo", { providerCount: 1 })], coding);
    expect(r[0].caveats).toContain("Single provider, no failover");
  });
});

describe("cost-to-capability frontier", () => {
  const pts = [
    { slug: "a", price: 0.1, intelligence: 30 },
    { slug: "b", price: 0.5, intelligence: 25 }, // dominated by a
    { slug: "c", price: 1, intelligence: 50 },
    { slug: "d", price: 5, intelligence: 50 }, // dominated by c (same score, pricier)
    { slug: "e", price: 10, intelligence: 70 },
  ];
  it("keeps only non-dominated models", () => {
    expect(paretoFrontier(pts).map((p) => p.slug)).toEqual(["a", "c", "e"]);
  });
  it("measures how far a model sits below the frontier", () => {
    const f = paretoFrontier(pts);
    expect(frontierGap(pts[1], f)).toBe(5);
    expect(frontierGap(pts[2], f)).toBe(0);
  });
});
