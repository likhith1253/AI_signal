import { describe, expect, it } from "vitest";
import { composite, DEFAULT_WEIGHTS, MIN_CONFIDENCE, parseWeights, percentile, quantile, scoreModel, type Population, type ScoreInput } from "@/server/scoring/engine";

const pop: Population = {
  intelligence: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  coding: [10, 20, 30, 40, 50],
  agentic: [5, 15, 25],
  codeArena: [1000, 1100, 1200, 1300],
  prices: [0.05, 0.1, 0.3, 1, 3, 10, 30],
};

const input = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  intelligenceIndex: 80,
  codingIndex: 40,
  agenticIndex: null,
  codeArenaElo: null,
  blendedPrice: 1,
  isFree: false,
  contextLength: 131072,
  providerCount: 4,
  bestUptime: 99.5,
  inputModalities: ["text", "image"],
  capabilities: ["tools", "structured-outputs"],
  ...over,
});

describe("percentile", () => {
  it("uses mid-rank so ties share a percentile", () => {
    expect(percentile([1, 2, 3, 4], 3)).toBe(62.5);
    expect(percentile([5, 5, 5, 5], 5)).toBe(50);
    expect(percentile([], 1)).toBe(50);
  });
  it("interpolates quantiles", () => {
    expect(quantile([0, 10], 0.5)).toBe(5);
  });
});

describe("scoreModel", () => {
  it("scores every dimension and explains each", () => {
    const r = scoreModel(input(), pop);
    expect(r.dimensions.capability).toBe(75); // 7 below + half of 1 tie, of 10
    expect(r.dimensions.coding).toBe(70);
    expect(r.dimensions.agentic).toBeNull();
    expect(r.dimensions.context).toBeCloseTo(57.1, 1); // log2(128K) between 8K and 1M
    expect(r.dimensions.versatility).toBe(15 + 20 + 15);
    expect(r.traces).toHaveLength(8);
    expect(r.traces.find((t) => t.key === "capability")?.raw).toBe("AA Intelligence Index 80");
  });

  it("falls back to Design Arena Elo for coding when no coding index exists", () => {
    const r = scoreModel(input({ codingIndex: null, codeArenaElo: 1250 }), pop);
    expect(r.dimensions.coding).toBe(75);
    expect(r.traces.find((t) => t.key === "coding")?.method).toMatch(/fallback/);
  });

  it("rates free models 100 on cost and leaves unknown price unscored (not zero)", () => {
    expect(scoreModel(input({ isFree: true, blendedPrice: 0 }), pop).dimensions.costEfficiency).toBe(100);
    const unknown = scoreModel(input({ blendedPrice: null }), pop);
    expect(unknown.dimensions.costEfficiency).toBeNull();
    expect(unknown.dimensions.value).toBeNull();
  });

  it("cheaper is better on a clamped log scale", () => {
    const cheap = scoreModel(input({ blendedPrice: 0.06 }), pop).dimensions.costEfficiency!;
    const pricey = scoreModel(input({ blendedPrice: 20 }), pop).dimensions.costEfficiency!;
    expect(cheap).toBeGreaterThan(pricey);
    expect(scoreModel(input({ blendedPrice: 0.0001 }), pop).dimensions.costEfficiency).toBe(100);
  });
});

describe("composite", () => {
  it("excludes missing dimensions instead of zeroing them and reports coverage", () => {
    const dims = { capability: 80, coding: null, agentic: null, costEfficiency: 60, value: 70, context: 50, availability: 90, versatility: 40 };
    const c = composite(dims, DEFAULT_WEIGHTS);
    expect(c.confidence).toBe(0.85);
    const manual = (80 * 0.3 + 60 * 0.1 + 70 * 0.15 + 50 * 0.1 + 90 * 0.1 + 40 * 0.1) / 0.85;
    expect(c.overall).toBeCloseTo(manual, 1);
  });

  it("withholds the overall score below the coverage threshold", () => {
    const noBenchmarks = { capability: null, coding: null, agentic: null, costEfficiency: 95, value: null, context: 90, availability: 90, versatility: 80 };
    const c = composite(noBenchmarks);
    expect(c.confidence).toBeLessThan(MIN_CONFIDENCE);
    expect(c.overall).toBeNull();
    expect(composite(noBenchmarks, DEFAULT_WEIGHTS, 0).overall).not.toBeNull();
  });

  it("re-ranks under custom weights", () => {
    const a = { capability: 90, coding: null, agentic: null, costEfficiency: 10, value: 30, context: 50, availability: 50, versatility: 50 };
    const b = { capability: 50, coding: null, agentic: null, costEfficiency: 95, value: 70, context: 50, availability: 50, versatility: 50 };
    expect(composite(a, { capability: 1 }).overall!).toBeGreaterThan(composite(b, { capability: 1 }).overall!);
    expect(composite(b, { costEfficiency: 1 }).overall!).toBeGreaterThan(composite(a, { costEfficiency: 1 }).overall!);
  });

  it("parses weights from a query string and ignores junk", () => {
    expect(parseWeights("capability:0.5,value:0.3,hack:9,coding:abc")).toEqual({ capability: 0.5, value: 0.3 });
    expect(parseWeights("")).toBeNull();
    expect(parseWeights("nope:1")).toBeNull();
  });
});
