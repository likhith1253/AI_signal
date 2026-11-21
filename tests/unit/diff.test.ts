import { describe, expect, it } from "vitest";
import { diffCatalog, summarize, type CatalogModel } from "@/server/ingest/diff";

const price = (component: "INPUT" | "OUTPUT", amountUsd: number | null, isVariable = false) => ({ component, unit: "PER_MILLION_TOKENS" as const, amountUsd, isVariable, minPromptTokens: 0 });

const model = (over: Partial<CatalogModel> = {}): CatalogModel => ({
  externalId: "acme/one",
  contextLength: 128000,
  maxOutputTokens: 8192,
  status: "ACTIVE",
  inputModalities: ["text"],
  outputModalities: ["text"],
  offerings: [{ tag: "deepinfra", prices: [price("INPUT", 1), price("OUTPUT", 3)] }],
  benchmarks: { "aa-intelligence-index": 50 },
  ...over,
});

describe("diffCatalog", () => {
  it("reports nothing for an identical catalogue (idempotent re-ingest)", () => {
    const prev = new Map([["acme/one", model()]]);
    const changes = diffCatalog(prev, [model()]);
    expect(changes).toEqual([]);
    expect(summarize(changes, 1)).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
  });

  it("ignores modality ordering", () => {
    const prev = new Map([["acme/one", model({ inputModalities: ["text", "image"] })]]);
    expect(diffCatalog(prev, [model({ inputModalities: ["image", "text"] })])).toEqual([]);
  });

  it("detects added and removed models", () => {
    const prev = new Map([["acme/old", model({ externalId: "acme/old" })]]);
    const changes = diffCatalog(prev, [model()]);
    expect(changes.map((c) => c.kind).sort()).toEqual(["MODEL_ADDED", "MODEL_REMOVED"]);
  });

  it("treats a previously REMOVED model coming back as added, and does not re-remove it", () => {
    const prev = new Map([
      ["acme/one", model({ status: "REMOVED" })],
      ["acme/gone", model({ externalId: "acme/gone", status: "REMOVED" })],
    ]);
    const changes = diffCatalog(prev, [model()]);
    expect(changes).toEqual([{ kind: "MODEL_ADDED", subject: "acme/one", after: { contextLength: 128000 } }]);
  });

  it("records price changes with before/after per offering and component", () => {
    const prev = new Map([["acme/one", model()]]);
    const next = model({ offerings: [{ tag: "deepinfra", prices: [price("INPUT", 0.8), price("OUTPUT", 3)] }] });
    expect(diffCatalog(prev, [next])).toEqual([{ kind: "PRICE_CHANGED", subject: "acme/one", field: "deepinfra:INPUT@0", before: 1, after: 0.8 }]);
  });

  it("distinguishes a price becoming unknown or variable from a change in amount", () => {
    const prev = new Map([["acme/one", model()]]);
    const next = model({ offerings: [{ tag: "deepinfra", prices: [price("INPUT", null, true)] }] });
    const changes = diffCatalog(prev, [next]);
    expect(changes).toContainEqual({ kind: "PRICE_CHANGED", subject: "acme/one", field: "deepinfra:INPUT@0", before: 1, after: "variable" });
    expect(changes).toContainEqual({ kind: "PRICE_CHANGED", subject: "acme/one", field: "deepinfra:OUTPUT@0", before: 3, after: null });
  });

  it("detects offerings added/removed, spec and benchmark changes", () => {
    const prev = new Map([["acme/one", model()]]);
    const next = model({ contextLength: 256000, offerings: [{ tag: "groq", prices: [] }], benchmarks: { "aa-intelligence-index": 52, "aa-coding-index": 40 } });
    const kinds = diffCatalog(prev, [next]).map((c) => `${c.kind}:${c.field ?? ""}`);
    expect(kinds).toEqual(
      expect.arrayContaining(["MODEL_UPDATED:contextLength", "OFFERING_ADDED:groq", "OFFERING_REMOVED:deepinfra", "BENCHMARK_CHANGED:aa-intelligence-index", "BENCHMARK_CHANGED:aa-coding-index"]),
    );
    const s = summarize(diffCatalog(prev, [next]), 1);
    expect(s.updated).toBe(1);
    expect(s.unchanged).toBe(0);
  });
});
