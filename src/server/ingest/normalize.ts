/**
 * Pure normalization functions for the Atlas Engine.
 * No I/O here - everything is deterministic and unit-tested.
 */
import type { ORModel, ORPricing } from "./openrouter/schemas";

/** "anthropic/claude-sonnet-4.5" -> "anthropic-claude-sonnet-4-5" */
export function modelSlug(externalId: string): string {
  return externalId
    .replace(/^~/, "")
    .toLowerCase()
    .replace(/[/:.]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Lab identifiers that refer to the same organisation at the source. */
const LAB_ALIASES: Record<string, string> = {
  "meta-llama": "meta",
  "bytedance-seed": "bytedance",
  "~unbiased": "unbiased",
};

/** "~openai/gpt-latest" -> "openai", "meta-llama/llama-3" -> "meta" */
export function labKeyFromId(externalId: string): string {
  const raw = externalId.split("/")[0].toLowerCase();
  if (LAB_ALIASES[raw]) return LAB_ALIASES[raw];
  return raw.replace(/^~/, "");
}

/** "Anthropic: Claude Sonnet 4.5" -> { prefix: "Anthropic", name: "Claude Sonnet 4.5" } */
export function splitDisplayName(raw: string): { prefix: string | null; name: string } {
  const idx = raw.indexOf(": ");
  if (idx > 0 && idx < 40) return { prefix: raw.slice(0, idx).trim(), name: raw.slice(idx + 2).trim() };
  return { prefix: null, name: raw.trim() };
}

/** Derive a model family from its display name. */
export function deriveFamily(name: string): string | null {
  const cleaned = name.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  const words: string[] = [];
  for (const t of tokens) {
    if (/\d/.test(t)) break;
    words.push(t);
  }
  let family = words.join(" ");
  if (!family) {
    const m = tokens[0].match(/^[A-Za-z]+/);
    family = m ? m[0] : "";
  }
  family = family.replace(/[-:,]+$/, "").trim();
  // long phrase names without versions ("Auto Router", "Hermes Uncensored") keep only 2 words
  const parts = family.split(" ");
  if (parts.length > 2) family = parts.slice(0, 2).join(" ");
  return family.length >= 2 ? family : null;
}

export type PriceComponentKey =
  | "INPUT"
  | "OUTPUT"
  | "CACHE_READ"
  | "CACHE_WRITE"
  | "REASONING"
  | "IMAGE_INPUT"
  | "AUDIO_INPUT"
  | "IMAGE_OUTPUT"
  | "AUDIO_OUTPUT"
  | "WEB_SEARCH"
  | "REQUEST";

export type PriceUnitKey =
  | "PER_MILLION_TOKENS"
  | "PER_IMAGE"
  | "PER_SEARCH"
  | "PER_REQUEST"
  | "PER_MILLION_UNITS";

export interface NormalizedPrice {
  component: PriceComponentKey;
  unit: PriceUnitKey;
  /** USD in the unit's scale; null only when isVariable */
  amountUsd: number | null;
  isVariable: boolean;
  minPromptTokens: number;
}

/** source key -> (component, unit, multiplier to convert per-token into unit scale) */
const PRICE_MAP: Record<string, [PriceComponentKey, PriceUnitKey, number]> = {
  prompt: ["INPUT", "PER_MILLION_TOKENS", 1_000_000],
  completion: ["OUTPUT", "PER_MILLION_TOKENS", 1_000_000],
  input_cache_read: ["CACHE_READ", "PER_MILLION_TOKENS", 1_000_000],
  input_cache_write: ["CACHE_WRITE", "PER_MILLION_TOKENS", 1_000_000],
  internal_reasoning: ["REASONING", "PER_MILLION_TOKENS", 1_000_000],
  image: ["IMAGE_INPUT", "PER_IMAGE", 1],
  audio: ["AUDIO_INPUT", "PER_MILLION_UNITS", 1_000_000],
  image_output: ["IMAGE_OUTPUT", "PER_MILLION_TOKENS", 1_000_000],
  audio_output: ["AUDIO_OUTPUT", "PER_MILLION_UNITS", 1_000_000],
  web_search: ["WEB_SEARCH", "PER_SEARCH", 1],
  request: ["REQUEST", "PER_REQUEST", 1],
};

/** Parse one source price value. */
export function parsePriceValue(
  raw: string | number | undefined | null,
  multiplier: number,
): { amountUsd: number | null; isVariable: boolean } | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n < 0) return { amountUsd: null, isVariable: true };
  // round to 6 decimals to avoid float noise like 0.30000000000000004
  return { amountUsd: Math.round(n * multiplier * 1e6) / 1e6, isVariable: false };
}

export function normalizePricing(p: ORPricing): NormalizedPrice[] {
  const out: NormalizedPrice[] = [];
  const add = (src: Record<string, unknown>, minPromptTokens: number) => {
    for (const [key, [component, unit, mult]] of Object.entries(PRICE_MAP)) {
      const parsed = parsePriceValue(src[key] as string | undefined, mult);
      if (!parsed) continue;
      // 0 for optional components (e.g. "image": "0" on text models) is meaningless noise;
      // only keep zeros for the token components that define free models.
      if (parsed.amountUsd === 0 && component !== "INPUT" && component !== "OUTPUT") continue;
      out.push({ component, unit, minPromptTokens, ...parsed });
    }
  };
  add(p as Record<string, unknown>, 0);
  // Only context-length tiers are modelled; time-of-day windows (utc_days/utc_start)
  // are ignored and the base price is kept as the reference price.
  for (const o of p.overrides ?? []) {
    const min = o.min_prompt_tokens;
    if (typeof min === "number" && min > 0 && o.utc_start === undefined && o.utc_days === undefined) add(o, min);
  }
  return out;
}

/** Industry-standard 3:1 input:output blend, USD per 1M tokens. */
export function blendedPrice(input: number | null | undefined, output: number | null | undefined) {
  if (input == null || output == null) return null;
  return Math.round(((3 * input + output) / 4) * 1e6) / 1e6;
}

export type ModelTypeKey =
  | "CHAT"
  | "REASONING"
  | "MULTIMODAL"
  | "IMAGE_GENERATION"
  | "AUDIO"
  | "VIDEO"
  | "EMBEDDING"
  | "ROUTER";

export function classifyModelType(m: Pick<ORModel, "id" | "architecture" | "pricing" | "supported_parameters" | "reasoning">): ModelTypeKey {
  const id = m.id.toLowerCase();
  const out = m.architecture.output_modalities ?? [];
  const inp = m.architecture.input_modalities ?? [];
  const params = m.supported_parameters ?? [];
  if (id.startsWith("openrouter/") || Number(m.pricing.prompt) < 0) return "ROUTER";
  if (id.includes("embed")) return "EMBEDDING";
  if (out.includes("video")) return "VIDEO";
  if (out.includes("image")) return "IMAGE_GENERATION";
  if (out.includes("audio")) return "AUDIO";
  if (m.reasoning || params.includes("reasoning") || params.includes("include_reasoning")) return "REASONING";
  if (inp.some((x) => x !== "text")) return "MULTIMODAL";
  return "CHAT";
}

export const MODALITIES = ["text", "image", "audio", "video", "file"] as const;

export interface CapabilityDef {
  slug: string;
  name: string;
  description: string;
}

export const CAPABILITIES: CapabilityDef[] = [
  { slug: "tools", name: "Tool calling", description: "Accepts tool/function definitions and emits structured calls." },
  { slug: "structured-outputs", name: "Structured outputs", description: "Can be constrained to a JSON schema." },
  { slug: "json-mode", name: "JSON mode", description: "Supports response_format JSON output." },
  { slug: "reasoning", name: "Reasoning", description: "Exposes an internal reasoning / thinking phase." },
  { slug: "vision", name: "Vision", description: "Accepts image input." },
  { slug: "audio-input", name: "Audio input", description: "Accepts audio input." },
  { slug: "file-input", name: "File input", description: "Accepts documents (e.g. PDF) as input." },
  { slug: "video-input", name: "Video input", description: "Accepts video input." },
  { slug: "image-generation", name: "Image generation", description: "Produces images." },
  { slug: "web-search", name: "Web search", description: "Priced web-search grounding is available." },
  { slug: "prompt-caching", name: "Prompt caching", description: "Discounted cached-input pricing is published." },
  { slug: "long-context", name: "Long context", description: "Context window of 200K tokens or more." },
  { slug: "open-weights", name: "Open weights", description: "Weights are published on Hugging Face." },
];

/** Derive capabilities with the evidence that established each one. */
export function deriveCapabilities(m: ORModel): { slug: string; evidence: string }[] {
  const caps: { slug: string; evidence: string }[] = [];
  const params = new Set(m.supported_parameters ?? []);
  const inp = m.architecture.input_modalities ?? [];
  const out = m.architecture.output_modalities ?? [];
  const p = m.pricing as Record<string, unknown>;
  if (params.has("tools")) caps.push({ slug: "tools", evidence: "supported_parameters:tools" });
  if (params.has("structured_outputs")) caps.push({ slug: "structured-outputs", evidence: "supported_parameters:structured_outputs" });
  if (params.has("response_format")) caps.push({ slug: "json-mode", evidence: "supported_parameters:response_format" });
  if (m.reasoning || params.has("reasoning") || params.has("include_reasoning"))
    caps.push({ slug: "reasoning", evidence: m.reasoning ? "reasoning" : "supported_parameters:reasoning" });
  if (inp.includes("image")) caps.push({ slug: "vision", evidence: "architecture.input_modalities:image" });
  if (inp.includes("audio")) caps.push({ slug: "audio-input", evidence: "architecture.input_modalities:audio" });
  if (inp.includes("file")) caps.push({ slug: "file-input", evidence: "architecture.input_modalities:file" });
  if (inp.includes("video")) caps.push({ slug: "video-input", evidence: "architecture.input_modalities:video" });
  if (out.includes("image")) caps.push({ slug: "image-generation", evidence: "architecture.output_modalities:image" });
  if (Number(p.web_search) > 0) caps.push({ slug: "web-search", evidence: "pricing.web_search" });
  if (Number(p.input_cache_read) > 0) caps.push({ slug: "prompt-caching", evidence: "pricing.input_cache_read" });
  if ((m.context_length ?? 0) >= 200_000) caps.push({ slug: "long-context", evidence: `context_length:${m.context_length}` });
  if (m.hugging_face_id) caps.push({ slug: "open-weights", evidence: `hugging_face_id:${m.hugging_face_id}` });
  return caps;
}

export function deriveStatus(m: Pick<ORModel, "alias_target" | "expiration_date">, now = new Date()) {
  if (m.alias_target) return "ALIAS" as const;
  if (m.expiration_date) {
    const d = new Date(m.expiration_date);
    if (!Number.isNaN(d.getTime()) && d < now) return "DEPRECATED" as const;
  }
  return "ACTIVE" as const;
}

/** OpenRouter descriptions are truncated with "..." and contain markdown links. */
export function cleanDescription(d: string | null | undefined): string | null {
  if (!d) return null;
  return d
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Endpoint tag "deepinfra/turbo" -> provider slug "deepinfra". */
export function providerSlugFromTag(tag: string | null | undefined, providerName: string): string {
  if (tag) return tag.split("/")[0].toLowerCase();
  return slugify(providerName);
}
