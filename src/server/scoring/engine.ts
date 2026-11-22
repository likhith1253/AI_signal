/** Atlas Intelligence Score - methodology "atlas-v1". */

export const METHODOLOGY = "atlas-v1";

export type DimensionKey =
  | "capability"
  | "coding"
  | "agentic"
  | "costEfficiency"
  | "value"
  | "context"
  | "availability"
  | "versatility";

export interface ScoreInput {
  /** Artificial Analysis indices (published, 0–100 scale) */
  intelligenceIndex: number | null;
  codingIndex: number | null;
  agenticIndex: number | null;
  /** fallback coding signal: Design Arena code Elo */
  codeArenaElo: number | null;
  blendedPrice: number | null; // USD / 1M tokens, 3:1 blend
  isFree: boolean;
  contextLength: number | null;
  providerCount: number;
  bestUptime: number | null; // %, last 24h
  inputModalities: string[];
  capabilities: string[];
}

/** Sorted ascending arrays of the population, used for percentiles and bounds. */
export interface Population {
  intelligence: number[];
  coding: number[];
  agentic: number[];
  codeArena: number[];
  /** positive (non-free) blended prices */
  prices: number[];
}

export interface DimensionTrace {
  key: DimensionKey;
  label: string;
  score: number | null;
  raw: string; // human-readable input, e.g. "AA Intelligence Index 61.4"
  method: string; // how raw became score
}

export interface ScoreResult {
  methodology: string;
  dimensions: Record<DimensionKey, number | null>;
  traces: DimensionTrace[];
}

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  capability: "Capability",
  coding: "Coding",
  agentic: "Agentic",
  costEfficiency: "Cost efficiency",
  value: "Value",
  context: "Context capacity",
  availability: "Availability",
  versatility: "Versatility",
};

export const DIMENSION_DESCRIPTIONS: Record<DimensionKey, string> = {
  capability: "Percentile of the Artificial Analysis Intelligence Index among all models that have one.",
  coding: "Percentile of the AA Coding Index; falls back to Design Arena code-category Elo percentile.",
  agentic: "Percentile of the AA Agentic Index.",
  costEfficiency: "Cheapest 3:1 blended price on a log scale between the catalogue's 5th and 95th percentile.",
  value: "Geometric mean of capability and cost efficiency - capability per dollar.",
  context: "Context window on a log₂ scale from 8K (0) to 1M tokens (100).",
  availability: "Number of serving providers (log scale, 85%) and best 24h uptime (15%).",
  versatility: "Non-text input modalities plus tool calling, structured outputs and reasoning.",
};

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Fraction of population strictly below v, plus half of ties (mid-rank). 0–100. */
export function percentile(sorted: number[], v: number): number {
  if (sorted.length === 0) return 50;
  let below = 0;
  let equal = 0;
  for (const x of sorted) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return round1(((below + equal / 2) / sorted.length) * 100);
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const fmtUsd = (v: number) => (v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`);
const fmtTokens = (v: number) =>
  v >= 1_000_000 ? `${round1(v / 1_000_000)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`;

export function scoreModel(input: ScoreInput, pop: Population): ScoreResult {
  const traces: DimensionTrace[] = [];
  const push = (key: DimensionKey, score: number | null, raw: string, method: string) => {
    traces.push({ key, label: DIMENSION_LABELS[key], score: score == null ? null : round1(score), raw, method });
  };

  // capability
  const capability = input.intelligenceIndex == null ? null : percentile(pop.intelligence, input.intelligenceIndex);
  push(
    "capability",
    capability,
    input.intelligenceIndex == null ? "No AA Intelligence Index published" : `AA Intelligence Index ${input.intelligenceIndex}`,
    `percentile among ${pop.intelligence.length} indexed models`,
  );

  // coding
  let coding: number | null = null;
  if (input.codingIndex != null) {
    coding = percentile(pop.coding, input.codingIndex);
    push("coding", coding, `AA Coding Index ${input.codingIndex}`, `percentile among ${pop.coding.length} models`);
  } else if (input.codeArenaElo != null) {
    coding = percentile(pop.codeArena, input.codeArenaElo);
    push("coding", coding, `Design Arena code Elo ${input.codeArenaElo}`, `fallback: percentile among ${pop.codeArena.length} arena models`);
  } else {
    push("coding", null, "No coding benchmark published", "excluded from weighting");
  }

  // agentic
  const agentic = input.agenticIndex == null ? null : percentile(pop.agentic, input.agenticIndex);
  push(
    "agentic",
    agentic,
    input.agenticIndex == null ? "No AA Agentic Index published" : `AA Agentic Index ${input.agenticIndex}`,
    `percentile among ${pop.agentic.length} models`,
  );

  // cost efficiency
  let costEfficiency: number | null = null;
  if (input.isFree) {
    costEfficiency = 100;
    push("costEfficiency", 100, "Free tier ($0 input and output)", "free models score 100");
  } else if (input.blendedPrice != null && input.blendedPrice > 0 && pop.prices.length > 1) {
    const lo = quantile(pop.prices, 0.05);
    const hi = quantile(pop.prices, 0.95);
    const p = clamp(input.blendedPrice, lo, hi);
    costEfficiency = clamp((100 * (Math.log(hi) - Math.log(p))) / (Math.log(hi) - Math.log(lo)));
    push(
      "costEfficiency",
      costEfficiency,
      `${fmtUsd(input.blendedPrice)} / 1M tokens blended`,
      `log scale: ${fmtUsd(lo)} (p5) = 100 … ${fmtUsd(hi)} (p95) = 0`,
    );
  } else {
    push("costEfficiency", null, "Price unknown or variable", "excluded from weighting");
  }

  // value
  const value = capability != null && costEfficiency != null ? Math.sqrt(capability * costEfficiency) : null;
  push(
    "value",
    value,
    value == null ? "Needs both capability and price" : `√(${round1(capability!)} × ${round1(costEfficiency!)})`,
    "geometric mean of capability and cost efficiency",
  );

  // context
  let context: number | null = null;
  if (input.contextLength && input.contextLength > 0) {
    const lo = Math.log2(8192);
    const hi = Math.log2(1_048_576);
    context = clamp((100 * (Math.log2(input.contextLength) - lo)) / (hi - lo));
    push("context", context, `${fmtTokens(input.contextLength)} tokens`, "log₂ scale: 8K = 0 … 1M = 100");
  } else {
    push("context", null, "Context window not published", "excluded from weighting");
  }

  // availability
  let availability: number | null = null;
  if (input.providerCount > 0) {
    const reach = Math.min(1, Math.log2(1 + input.providerCount) / Math.log2(11)) * 100;
    availability = input.bestUptime == null ? reach : 0.85 * reach + 0.15 * clamp(input.bestUptime);
    push(
      "availability",
      availability,
      `${input.providerCount} provider${input.providerCount === 1 ? "" : "s"}${input.bestUptime != null ? `, ${round1(input.bestUptime)}% best uptime` : ""}`,
      "log₂ reach (10 providers = max) × 85% + uptime × 15%",
    );
  } else {
    push("availability", null, "No active provider endpoints", "excluded from weighting");
  }

  // versatility
  const extraInputs = input.inputModalities.filter((m) => m !== "text").length;
  const caps = new Set(input.capabilities);
  const versatility = clamp(
    Math.min(45, extraInputs * 15) + (caps.has("tools") ? 20 : 0) + (caps.has("structured-outputs") ? 15 : 0) + (caps.has("reasoning") ? 20 : 0),
  );
  push(
    "versatility",
    versatility,
    [
      extraInputs ? `${extraInputs} non-text input${extraInputs > 1 ? "s" : ""}` : "text-only input",
      caps.has("tools") && "tools",
      caps.has("structured-outputs") && "structured outputs",
      caps.has("reasoning") && "reasoning",
    ]
      .filter(Boolean)
      .join(", "),
    "15 per extra modality (max 45) + tools 20 + structured 15 + reasoning 20",
  );

  return {
    methodology: METHODOLOGY,
    dimensions: { capability, coding, agentic, costEfficiency, value, context, availability, versatility },
    traces,
  };
}

export type Weights = Partial<Record<DimensionKey, number>>;

export const DEFAULT_WEIGHTS: Required<Weights> = {
  capability: 0.3,
  coding: 0.1,
  agentic: 0.05,
  costEfficiency: 0.1,
  value: 0.15,
  context: 0.1,
  availability: 0.1,
  versatility: 0.1,
};

/**
 * An overall score is only published when at least this share of the weight is
 * backed by data. With default weights, benchmark dimensions carry 45%, so a
 * model with no benchmark signal at all can never receive an overall score.
 */
export const MIN_CONFIDENCE = 0.6;

export interface Composite {
  overall: number | null;
  /** share of total weight that was backed by data (0–1) */
  confidence: number;
  contributions: { key: DimensionKey; weight: number; score: number | null; contribution: number }[];
}

/**
 * Weighted mean over dimensions that have data. Weights of missing dimensions
 * are redistributed proportionally; `confidence` reports how much was missing.
 */
export function composite(dims: Record<DimensionKey, number | null>, weights: Weights = DEFAULT_WEIGHTS, minConfidence = MIN_CONFIDENCE): Composite {
  const entries = (Object.keys(weights) as DimensionKey[])
    .map((k) => ({ key: k, weight: Math.max(0, weights[k] ?? 0) }))
    .filter((e) => e.weight > 0);
  const total = entries.reduce((s, e) => s + e.weight, 0);
  const available = entries.filter((e) => dims[e.key] != null);
  const availWeight = available.reduce((s, e) => s + e.weight, 0);
  if (total === 0 || availWeight === 0) {
    return { overall: null, confidence: 0, contributions: entries.map((e) => ({ ...e, score: dims[e.key], contribution: 0 })) };
  }
  const contributions = entries.map((e) => {
    const score = dims[e.key];
    const contribution = score == null ? 0 : (score * e.weight) / availWeight;
    return { key: e.key, weight: e.weight / total, score, contribution: round1(contribution) };
  });
  const overall = round1(available.reduce((s, e) => s + (dims[e.key] as number) * e.weight, 0) / availWeight);
  const confidence = Math.round((availWeight / total) * 100) / 100;
  return { overall: confidence >= minConfidence ? overall : null, confidence, contributions };
}

/** Parse "capability:0.5,value:0.3" from a query string into weights. */
export function parseWeights(raw: string | null | undefined): Weights | null {
  if (!raw) return null;
  const out: Weights = {};
  for (const part of raw.split(",")) {
    const [k, v] = part.split(":");
    if (k in DIMENSION_LABELS) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 100) out[k as DimensionKey] = n;
    }
  }
  return Object.keys(out).length ? out : null;
}
