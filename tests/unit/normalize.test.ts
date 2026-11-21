import { describe, expect, it } from "vitest";
import {
  blendedPrice,
  classifyModelType,
  cleanDescription,
  deriveCapabilities,
  deriveFamily,
  deriveStatus,
  labKeyFromId,
  modelSlug,
  normalizePricing,
  parsePriceValue,
  providerSlugFromTag,
  splitDisplayName,
} from "@/server/ingest/normalize";
import { orModelSchema, orEndpointSchema } from "@/server/ingest/openrouter/schemas";
import { normalizeModel } from "@/server/ingest/pipeline";
import { orEndpoint, orModel } from "../fixtures/openrouter";

describe("identity normalization", () => {
  it("builds stable URL slugs from source ids", () => {
    expect(modelSlug("anthropic/claude-sonnet-4.5")).toBe("anthropic-claude-sonnet-4-5");
    expect(modelSlug("~openai/gpt-latest")).toBe("openai-gpt-latest");
    expect(modelSlug("meta-llama/llama-3.3-70b-instruct:free")).toBe("meta-llama-llama-3-3-70b-instruct-free");
  });

  it("maps source org prefixes onto one lab identity", () => {
    expect(labKeyFromId("meta-llama/llama-3")).toBe("meta");
    expect(labKeyFromId("~anthropic/claude-latest")).toBe("anthropic");
    expect(labKeyFromId("bytedance-seed/seed-1.6")).toBe("bytedance");
  });

  it("splits the lab prefix from display names", () => {
    expect(splitDisplayName("Anthropic: Claude Sonnet 4.5")).toEqual({ prefix: "Anthropic", name: "Claude Sonnet 4.5" });
    expect(splitDisplayName("Auto Router")).toEqual({ prefix: null, name: "Auto Router" });
  });

  it.each([
    ["Claude Sonnet 4.5", "Claude Sonnet"],
    ["GPT-4o mini", "GPT"],
    ["Llama 3.3 70B Instruct", "Llama"],
    ["Qwen3 Coder 480B", "Qwen"],
    ["Gemini 2.5 Flash", "Gemini"],
    ["DeepSeek V3.2", "DeepSeek"],
    ["Gemma 4 26B A4B (free)", "Gemma"],
  ])("derives family %s -> %s", (name, family) => {
    expect(deriveFamily(name)).toBe(family);
  });

  it("derives provider slug from endpoint tag", () => {
    expect(providerSlugFromTag("deepinfra/turbo", "DeepInfra")).toBe("deepinfra");
    expect(providerSlugFromTag(null, "Together AI")).toBe("together-ai");
  });

  it("strips markdown links from descriptions", () => {
    expect(cleanDescription("See [Pixtral](https://x.y) now")).toBe("See Pixtral now");
    expect(cleanDescription(null)).toBeNull();
  });
});

describe("pricing normalization", () => {
  it("distinguishes unknown, free and variable prices", () => {
    expect(parsePriceValue(undefined, 1e6)).toBeUndefined();
    expect(parsePriceValue("", 1e6)).toBeUndefined();
    expect(parsePriceValue("abc", 1e6)).toBeUndefined();
    expect(parsePriceValue("0", 1e6)).toEqual({ amountUsd: 0, isVariable: false });
    expect(parsePriceValue("-1", 1e6)).toEqual({ amountUsd: null, isVariable: true });
  });

  it("converts per-token USD to per-million without float noise", () => {
    expect(parsePriceValue("0.0000003", 1e6)).toEqual({ amountUsd: 0.3, isVariable: false });
    expect(parsePriceValue("0.000000132", 1e6)?.amountUsd).toBe(0.132);
  });

  it("keeps zero only for token components and models tiers", () => {
    const prices = normalizePricing({
      prompt: "0.000002",
      completion: "0.000006",
      image: "0",
      input_cache_read: "0.0000005",
      overrides: [
        { min_prompt_tokens: 200000, prompt: "0.000004", completion: "0.000012" },
        { utc_days: ["saturday"], prompt: "0.000001" },
      ],
    });
    const key = (c: string, t = 0) => prices.find((p) => p.component === c && p.minPromptTokens === t)?.amountUsd;
    expect(key("INPUT")).toBe(2);
    expect(key("OUTPUT")).toBe(6);
    expect(key("CACHE_READ")).toBe(0.5);
    expect(prices.some((p) => p.component === "IMAGE_INPUT")).toBe(false); // "0" image price is noise
    expect(key("INPUT", 200000)).toBe(4); // long-context tier kept
    expect(prices.filter((p) => p.minPromptTokens === 0 && p.component === "INPUT")).toHaveLength(1); // time window ignored
  });

  it("keeps free models as explicit zeros", () => {
    const prices = normalizePricing({ prompt: "0", completion: "0" });
    expect(prices.map((p) => p.amountUsd)).toEqual([0, 0]);
  });

  it("computes 3:1 blended price and refuses to guess with missing sides", () => {
    expect(blendedPrice(1, 5)).toBe(2);
    expect(blendedPrice(null, 5)).toBeNull();
  });
});

describe("classification", () => {
  const base = orModelSchema.parse(orModel);
  it("classifies multimodal, reasoning, image and router models", () => {
    expect(classifyModelType(base)).toBe("MULTIMODAL");
    expect(classifyModelType({ ...base, reasoning: { mandatory: true } })).toBe("REASONING");
    expect(classifyModelType({ ...base, architecture: { ...base.architecture, output_modalities: ["image", "text"] } })).toBe("IMAGE_GENERATION");
    expect(classifyModelType({ ...base, id: "openrouter/auto", pricing: { prompt: "-1", completion: "-1" } })).toBe("ROUTER");
  });

  it("derives capabilities with evidence", () => {
    const caps = deriveCapabilities(base);
    const slugs = caps.map((c) => c.slug);
    expect(slugs).toEqual(expect.arrayContaining(["tools", "json-mode", "vision"]));
    expect(slugs).not.toContain("open-weights");
    expect(caps.find((c) => c.slug === "vision")?.evidence).toBe("architecture.input_modalities:image");
  });

  it("derives status from alias and expiry", () => {
    expect(deriveStatus({ alias_target: { slug: "a/b" }, expiration_date: null })).toBe("ALIAS");
    expect(deriveStatus({ alias_target: null, expiration_date: "2020-01-01" })).toBe("DEPRECATED");
    expect(deriveStatus({ alias_target: null, expiration_date: "2999-01-01" })).toBe("ACTIVE");
  });
});

describe("normalizeModel (ingestion of a real-shaped record)", () => {
  it("produces a registry record with benchmarks and an aggregate offering fallback", () => {
    const m = normalizeModel(orModelSchema.parse(orModel), null);
    expect(m.slug).toBe("mistralai-pixtral-large-2502");
    expect(m.name).toBe("Pixtral Large 2502");
    expect(m.labKey).toBe("mistralai");
    expect(m.family).toBe("Pixtral Large");
    expect(m.offerings).toHaveLength(1);
    expect(m.offerings[0].tag).toBe("openrouter");
    // null AA values are skipped, domain indices kept, duplicate arena categories deduped
    expect(Object.keys(m.benchmarks).sort()).toEqual(["aa-agentic-index", "aa-intelligence-index", "aa-legal-index", "design-arena-website"]);
    expect(m.benchmarks["design-arena-website"]).toBe(1201);
  });

  it("uses per-provider endpoints when available and dedupes tags", () => {
    const ep = orEndpointSchema.parse(orEndpoint);
    const m = normalizeModel(orModelSchema.parse(orModel), [ep, ep]);
    expect(m.offerings).toHaveLength(1);
    expect(m.offerings[0]).toMatchObject({ tag: "deepinfra/turbo", providerSlug: "deepinfra", quantization: "fp8", uptime1d: 99.64 });
    expect(m.offerings[0].prices.find((p) => p.component === "INPUT")?.amountUsd).toBe(0.1);
  });

  it("rejects records missing required fields", () => {
    expect(orModelSchema.safeParse({ ...orModel, id: "no-slash" }).success).toBe(false);
    expect(orModelSchema.safeParse({ ...orModel, pricing: undefined }).success).toBe(false);
  });
});
