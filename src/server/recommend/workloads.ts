/**
 * Layer 6 — workload-based discovery.
 * A workload is a declarative profile: hard requirements (filters) + a weight
 * vector over Atlas dimensions. The recommender is deterministic and returns
 * human-readable reasons for every pick. A future learned/LLM recommender can
 * implement the same `Recommender` interface without touching callers.
 */
import { composite, type DimensionKey, type Weights } from "../scoring/engine";

export interface Workload {
  slug: string;
  name: string;
  summary: string;
  requires: {
    capabilities?: string[];
    anyCapability?: string[];
    minContext?: number;
    knownPrice?: boolean;
    types?: string[];
  };
  weights: Weights;
}

export const WORKLOADS: Workload[] = [
  {
    slug: "software-development",
    name: "Software development",
    summary: "Code generation, refactoring and agentic coding with tool use.",
    requires: { capabilities: ["tools"], types: ["CHAT", "REASONING", "MULTIMODAL"] },
    weights: { coding: 0.45, capability: 0.2, value: 0.15, context: 0.1, availability: 0.1 },
  },
  {
    slug: "complex-reasoning",
    name: "Complex reasoning",
    summary: "Multi-step analysis, maths and planning where quality dominates cost.",
    requires: { capabilities: ["reasoning"] },
    weights: { capability: 0.55, agentic: 0.1, value: 0.1, context: 0.1, availability: 0.15 },
  },
  {
    slug: "agents",
    name: "Agents & automation",
    summary: "Reliable tool calling and structured output inside long-running loops.",
    requires: { capabilities: ["tools", "structured-outputs"] },
    weights: { agentic: 0.4, capability: 0.25, availability: 0.2, value: 0.15 },
  },
  {
    slug: "document-analysis",
    name: "Document analysis",
    summary: "Reading long reports, contracts and PDFs end-to-end.",
    requires: { minContext: 128_000 },
    weights: { context: 0.3, capability: 0.3, value: 0.2, availability: 0.2 },
  },
  {
    slug: "vision",
    name: "Vision",
    summary: "Understanding screenshots, charts, photos and scanned documents.",
    requires: { capabilities: ["vision"] },
    weights: { capability: 0.35, versatility: 0.2, value: 0.25, availability: 0.2 },
  },
  {
    slug: "long-context",
    name: "Long-context processing",
    summary: "Whole-codebase or multi-document prompts beyond 200K tokens.",
    requires: { minContext: 200_000 },
    weights: { context: 0.45, capability: 0.25, value: 0.2, availability: 0.1 },
  },
  {
    slug: "cost-sensitive",
    name: "Cost-sensitive at scale",
    summary: "High-volume classification, extraction and chat where price per token matters most.",
    requires: { knownPrice: true, types: ["CHAT", "REASONING", "MULTIMODAL"] },
    weights: { costEfficiency: 0.45, value: 0.35, availability: 0.2 },
  },
];

export function getWorkload(slug: string) {
  return WORKLOADS.find((w) => w.slug === slug) ?? null;
}

export interface Candidate {
  slug: string;
  name: string;
  type: string;
  contextLength: number | null;
  blendedPrice: number | null;
  isFree: boolean;
  isOpenWeights: boolean;
  capabilities: string[];
  dimensions: Record<DimensionKey, number | null>;
  providerCount: number;
}

export interface Constraints {
  maxBlendedPrice?: number;
  minContext?: number;
  openWeightsOnly?: boolean;
  minConfidence?: number;
}

export interface Recommendation {
  slug: string;
  name: string;
  fit: number;
  confidence: number;
  reasons: string[];
  caveats: string[];
}

export function meetsRequirements(c: Candidate, w: Workload, k: Constraints = {}): boolean {
  const r = w.requires;
  if (r.capabilities && !r.capabilities.every((x) => c.capabilities.includes(x))) return false;
  if (r.anyCapability && !r.anyCapability.some((x) => c.capabilities.includes(x))) return false;
  if (r.types && !r.types.includes(c.type)) return false;
  const minCtx = Math.max(r.minContext ?? 0, k.minContext ?? 0);
  if (minCtx && (c.contextLength ?? 0) < minCtx) return false;
  if (r.knownPrice && c.blendedPrice == null && !c.isFree) return false;
  if (k.maxBlendedPrice != null) {
    if (c.blendedPrice == null && !c.isFree) return false;
    if (!c.isFree && (c.blendedPrice as number) > k.maxBlendedPrice) return false;
  }
  if (k.openWeightsOnly && !c.isOpenWeights) return false;
  return true;
}

const ordinal = (p: number) => {
  const top = Math.max(1, Math.round(100 - p));
  return `top ${top}%`;
};

export function explain(c: Candidate, w: Workload): { reasons: string[]; caveats: string[] } {
  const reasons: string[] = [];
  const caveats: string[] = [];
  const d = c.dimensions;
  const ranked = (Object.keys(w.weights) as DimensionKey[]).sort((a, b) => (w.weights[b] ?? 0) - (w.weights[a] ?? 0));
  for (const key of ranked) {
    const s = d[key];
    if (s == null) {
      if ((w.weights[key] ?? 0) >= 0.2) caveats.push(`No ${key === "capability" ? "intelligence" : key} benchmark data — ranked on other signals`);
      continue;
    }
    if (key === "coding" && s >= 60) reasons.push(`Coding benchmarks: ${ordinal(s)} of indexed models`);
    if (key === "capability" && s >= 60) reasons.push(`Intelligence index: ${ordinal(s)} of indexed models`);
    if (key === "agentic" && s >= 60) reasons.push(`Agentic index: ${ordinal(s)}`);
    if (key === "costEfficiency" && s >= 60)
      reasons.push(c.isFree ? "Free to use" : `$${c.blendedPrice?.toFixed(2)}/M blended — cheaper than most`);
    if (key === "value" && s >= 65) reasons.push("Strong capability per dollar");
    if (key === "context" && s >= 70 && c.contextLength) reasons.push(`${Math.round(c.contextLength / 1000)}K-token context window`);
    if (key === "availability" && c.providerCount >= 3) reasons.push(`Served by ${c.providerCount} providers`);
  }
  if (c.isOpenWeights) reasons.push("Open weights — can be self-hosted");
  if (c.providerCount === 1) caveats.push("Single provider — no failover");
  return { reasons: reasons.slice(0, 4), caveats: caveats.slice(0, 2) };
}

export function recommend(cands: Candidate[], w: Workload, k: Constraints = {}, limit = 12): Recommendation[] {
  const minConfidence = k.minConfidence ?? 0.5;
  return cands
    .filter((c) => meetsRequirements(c, w, k))
    .map((c) => {
      const comp = composite(c.dimensions, w.weights, 0);
      return { c, comp };
    })
    .filter(({ comp }) => comp.overall != null && comp.confidence >= minConfidence)
    // confidence-adjusted fit: a model with full data beats an equal score with gaps
    .map(({ c, comp }) => ({ c, comp, fit: (comp.overall as number) * (0.75 + 0.25 * comp.confidence) }))
    .sort((a, b) => b.fit - a.fit || a.c.slug.localeCompare(b.c.slug))
    .slice(0, limit)
    .map(({ c, comp, fit }) => ({
      slug: c.slug,
      name: c.name,
      fit: Math.round(fit * 10) / 10,
      confidence: comp.confidence,
      ...explain(c, w),
    }));
}
