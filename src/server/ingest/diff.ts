/**
 * The Atlas Engine diff stage. Compares the stored catalogue with an incoming
 * normalized catalogue and produces a changeset - the "plan" of an ingest run.
 * Pure: no database access, fully unit-tested.
 */
import type { NormalizedPrice } from "./normalize";

export interface CatalogOffering {
  tag: string;
  prices: NormalizedPrice[];
}

export interface CatalogModel {
  externalId: string;
  contextLength: number | null;
  maxOutputTokens: number | null;
  status: string;
  inputModalities: string[];
  outputModalities: string[];
  offerings: CatalogOffering[];
  benchmarks: Record<string, number>;
}

export type ChangeKindKey =
  | "MODEL_ADDED"
  | "MODEL_REMOVED"
  | "MODEL_UPDATED"
  | "OFFERING_ADDED"
  | "OFFERING_REMOVED"
  | "PRICE_CHANGED"
  | "BENCHMARK_CHANGED";

export interface Change {
  kind: ChangeKindKey;
  subject: string;
  field?: string;
  before?: unknown;
  after?: unknown;
}

export interface ChangesetSummary {
  added: number;
  removed: number;
  updated: number;
  offeringsAdded: number;
  offeringsRemoved: number;
  priceChanges: number;
  benchmarkChanges: number;
  unchanged: number;
}

const priceKey = (p: NormalizedPrice) => `${p.component}@${p.minPromptTokens}`;
const priceVal = (p: NormalizedPrice | undefined) => (p ? (p.isVariable ? "variable" : p.amountUsd) : null);
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function diffCatalog(prev: Map<string, CatalogModel>, next: CatalogModel[]): Change[] {
  const changes: Change[] = [];
  const seen = new Set<string>();

  for (const n of next) {
    seen.add(n.externalId);
    const p = prev.get(n.externalId);
    if (!p || p.status === "REMOVED") {
      changes.push({ kind: "MODEL_ADDED", subject: n.externalId, after: { contextLength: n.contextLength } });
      continue;
    }
    const s = n.externalId;
    if (p.contextLength !== n.contextLength)
      changes.push({ kind: "MODEL_UPDATED", subject: s, field: "contextLength", before: p.contextLength, after: n.contextLength });
    if (p.maxOutputTokens !== n.maxOutputTokens)
      changes.push({ kind: "MODEL_UPDATED", subject: s, field: "maxOutputTokens", before: p.maxOutputTokens, after: n.maxOutputTokens });
    if (p.status !== n.status) changes.push({ kind: "MODEL_UPDATED", subject: s, field: "status", before: p.status, after: n.status });
    if (!sameSet(p.inputModalities, n.inputModalities))
      changes.push({ kind: "MODEL_UPDATED", subject: s, field: "inputModalities", before: p.inputModalities, after: n.inputModalities });
    if (!sameSet(p.outputModalities, n.outputModalities))
      changes.push({ kind: "MODEL_UPDATED", subject: s, field: "outputModalities", before: p.outputModalities, after: n.outputModalities });

    // offerings & prices
    const prevOff = new Map(p.offerings.map((o) => [o.tag, o]));
    const nextTags = new Set(n.offerings.map((o) => o.tag));
    for (const o of n.offerings) {
      const po = prevOff.get(o.tag);
      if (!po) {
        changes.push({ kind: "OFFERING_ADDED", subject: s, field: o.tag });
        continue;
      }
      const pp = new Map(po.prices.map((x) => [priceKey(x), x]));
      const np = new Map(o.prices.map((x) => [priceKey(x), x]));
      for (const key of new Set([...pp.keys(), ...np.keys()])) {
        const before = priceVal(pp.get(key));
        const after = priceVal(np.get(key));
        if (before !== after) {
          changes.push({ kind: "PRICE_CHANGED", subject: s, field: `${o.tag}:${key}`, before, after });
        }
      }
    }
    for (const tag of prevOff.keys()) {
      if (!nextTags.has(tag)) changes.push({ kind: "OFFERING_REMOVED", subject: s, field: tag });
    }

    // benchmarks: log new results and moves of at least 1%; Elo ratings drift by a
    // point or two every day and that isn't worth a ledger entry
    for (const [slug, score] of Object.entries(n.benchmarks)) {
      const before = p.benchmarks[slug];
      if (before === undefined || Math.abs(before - score) >= Math.max(0.5, Math.abs(before) * 0.01))
        changes.push({ kind: "BENCHMARK_CHANGED", subject: s, field: slug, before: before ?? null, after: score });
    }
  }

  for (const [id, p] of prev) {
    if (!seen.has(id) && p.status !== "REMOVED") changes.push({ kind: "MODEL_REMOVED", subject: id });
  }
  return changes;
}

export function summarize(changes: Change[], nextCount: number): ChangesetSummary {
  const count = (k: ChangeKindKey) => changes.filter((c) => c.kind === k).length;
  const touched = new Set(changes.filter((c) => c.kind !== "MODEL_ADDED" && c.kind !== "MODEL_REMOVED").map((c) => c.subject));
  const added = count("MODEL_ADDED");
  return {
    added,
    removed: count("MODEL_REMOVED"),
    updated: touched.size,
    offeringsAdded: count("OFFERING_ADDED"),
    offeringsRemoved: count("OFFERING_REMOVED"),
    priceChanges: count("PRICE_CHANGED"),
    benchmarkChanges: count("BENCHMARK_CHANGED"),
    unchanged: Math.max(0, nextCount - added - touched.size),
  };
}
