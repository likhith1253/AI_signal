import { z } from "zod";

/** Accept "a,b" or repeated ?x=a&x=b, normalised to a de-duplicated string array. */
const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (!v) return [] as string[];
    const arr = Array.isArray(v) ? v : [v];
    return [...new Set(arr.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean))].slice(0, 30);
  });

const bool = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .optional()
  .transform((v) => v === true || v === "true" || v === "1");

const optNum = (min: number, max: number) => z.coerce.number().min(min).max(max).optional();

export const MODEL_SORTS = ["score", "newest", "input", "output", "blended", "context", "name", "providers"] as const;
export const MODEL_TYPES = ["CHAT", "REASONING", "MULTIMODAL", "IMAGE_GENERATION", "AUDIO", "VIDEO", "EMBEDDING", "ROUTER"] as const;

export const modelListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  lab: list,
  provider: list,
  modality: list, // input modalities
  output: list, // output modalities
  capability: list,
  type: list.pipe(z.array(z.enum(MODEL_TYPES))),
  maxPrice: optNum(0, 10_000), // blended USD / 1M
  minContext: optNum(0, 100_000_000),
  free: bool,
  openWeights: bool,
  includeInactive: bool,
  // "price" is accepted as an alias for the blended price
  sort: z.preprocess((v) => (v === "price" ? "blended" : v), z.enum(MODEL_SORTS).default("score")),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
export type ModelListQuery = z.infer<typeof modelListQuery>;

export const compareQuery = z.object({
  models: list.pipe(z.array(z.string().max(120)).min(1, "provide at least one model slug").max(4, "compare up to 4 models")),
});

export const RANKING_CATEGORIES = ["overall", "intelligence", "coding", "agentic", "value", "long-context", "cheapest", "design"] as const;

export const rankingsQuery = z.object({
  category: z.enum(RANKING_CATEGORIES).default("overall"),
  benchmark: z.string().max(80).optional(),
  type: list.pipe(z.array(z.enum(MODEL_TYPES))),
  capability: list,
  weights: z.string().max(300).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const benchmarksQuery = z.object({
  category: z.string().max(40).optional(),
  benchmarks: list,
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const searchQuery = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(6),
});

export const recommendQuery = z.object({
  workload: z.string().max(60),
  maxPrice: optNum(0, 10_000),
  minContext: optNum(0, 100_000_000),
  openWeights: bool,
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

/** URLSearchParams -> plain object, preserving repeated keys as arrays. */
export function searchParamsToObject(sp: URLSearchParams | Record<string, string | string[] | undefined>) {
  const out: Record<string, string | string[]> = {};
  if (sp instanceof URLSearchParams) {
    for (const key of new Set(sp.keys())) {
      const all = sp.getAll(key);
      out[key] = all.length > 1 ? all : all[0];
    }
    return out;
  }
  for (const [k, v] of Object.entries(sp)) if (v !== undefined) out[k] = v;
  return out;
}
