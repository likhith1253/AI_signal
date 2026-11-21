import { z } from "zod";

/**
 * Zod schemas for the public OpenRouter catalogue.
 * Verified against live responses of:
 *   GET https://openrouter.ai/api/v1/models
 *   GET https://openrouter.ai/api/v1/models/{author}/{slug}/endpoints
 *   GET https://openrouter.ai/api/v1/providers
 *
 * Schemas are intentionally permissive (passthrough on unknown keys, nullable
 * optional fields) so that an additive upstream change does not break ingestion,
 * while still rejecting records that lack the fields we depend on.
 */

/** OpenRouter quotes prices as decimal strings in USD per single token/unit. */
const priceString = z.union([z.string(), z.number()]).transform((v) => String(v));

export const orPricingSchema = z
  .object({
    prompt: priceString.optional(),
    completion: priceString.optional(),
    image: priceString.optional(),
    audio: priceString.optional(),
    web_search: priceString.optional(),
    internal_reasoning: priceString.optional(),
    input_cache_read: priceString.optional(),
    input_cache_write: priceString.optional(),
    image_output: priceString.optional(),
    audio_output: priceString.optional(),
    request: priceString.optional(),
    discount: z.number().optional(),
    /** tiered (min_prompt_tokens) or time-of-day (utc_days/utc_start) overrides */
    overrides: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

const aaSchema = z
  .object({
    intelligence_index: z.number().nullable().optional(),
    coding_index: z.number().nullable().optional(),
    agentic_index: z.number().nullable().optional(),
  })
  .catchall(z.number().nullable());

const designArenaEntry = z.object({
  arena: z.string(),
  category: z.string(),
  elo: z.number(),
  win_rate: z.number().nullable().optional(),
  rank: z.number().nullable().optional(),
});

export const orModelSchema = z
  .object({
    id: z.string().min(3).regex(/^[~\w.-]+\/[\w.:~-]+$/, "unexpected id format"),
    canonical_slug: z.string().nullable().optional(),
    hugging_face_id: z.string().nullable().optional(),
    name: z.string().min(1),
    created: z.number().int().positive(),
    description: z.string().nullable().optional(),
    context_length: z.number().int().nullable().optional(),
    architecture: z
      .object({
        modality: z.string().nullable().optional(),
        input_modalities: z.array(z.string()).default([]),
        output_modalities: z.array(z.string()).default([]),
        tokenizer: z.string().nullable().optional(),
        instruct_type: z.string().nullable().optional(),
      })
      .passthrough(),
    pricing: orPricingSchema,
    top_provider: z
      .object({
        context_length: z.number().nullable().optional(),
        max_completion_tokens: z.number().nullable().optional(),
        is_moderated: z.boolean().nullable().optional(),
      })
      .nullable()
      .optional(),
    supported_parameters: z.array(z.string()).nullable().optional(),
    knowledge_cutoff: z.string().nullable().optional(),
    expiration_date: z.string().nullable().optional(),
    reasoning: z
      .object({ mandatory: z.boolean().optional() })
      .passthrough()
      .nullable()
      .optional(),
    alias_target: z.object({ slug: z.string(), name: z.string().optional() }).nullable().optional(),
    benchmarks: z
      .object({
        artificial_analysis: aaSchema.nullable().optional(),
        design_arena: z.array(designArenaEntry).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export type ORModel = z.infer<typeof orModelSchema>;
export type ORPricing = z.infer<typeof orPricingSchema>;

export const orEndpointSchema = z
  .object({
    name: z.string(),
    provider_name: z.string(),
    tag: z.string().nullable().optional(),
    context_length: z.number().nullable().optional(),
    max_completion_tokens: z.number().nullable().optional(),
    max_prompt_tokens: z.number().nullable().optional(),
    quantization: z.string().nullable().optional(),
    pricing: orPricingSchema,
    supported_parameters: z.array(z.string()).nullable().optional(),
    status: z.number().nullable().optional(),
    uptime_last_1d: z.number().nullable().optional(),
    supports_implicit_caching: z.boolean().nullable().optional(),
  })
  .passthrough();

export type OREndpoint = z.infer<typeof orEndpointSchema>;

export const orEndpointsResponseSchema = z.object({
  data: z.object({ id: z.string(), endpoints: z.array(z.unknown()) }).passthrough(),
});

export const orProviderSchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    privacy_policy_url: z.string().nullable().optional(),
    terms_of_service_url: z.string().nullable().optional(),
    status_page_url: z.string().nullable().optional(),
    headquarters: z.string().nullable().optional(),
    datacenters: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

export type ORProvider = z.infer<typeof orProviderSchema>;
