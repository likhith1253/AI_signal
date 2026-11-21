# Data sources

| Source | What we use | How | Kind |
|---|---|---|---|
| [OpenRouter `GET /api/v1/models`](https://openrouter.ai/api/v1/models) | model id, name, description, created date, context length, architecture (modalities, tokenizer), pricing, top-provider limits, supported parameters, knowledge cutoff, expiry, alias target, Hugging Face id, benchmarks block | public, unauthenticated | API |
| OpenRouter `GET /api/v1/models/{author}/{slug}/endpoints` | per-provider offerings: provider, tag, context, max output, quantization, pricing, uptime (24h), status, implicit caching | public; 6 requests in flight with backoff | API |
| OpenRouter `GET /api/v1/providers` | provider name, slug, headquarters, datacenters, privacy/terms/status URLs | public | API |
| [Artificial Analysis](https://artificialanalysis.ai/methodology) | Intelligence, Coding, Agentic and domain indices (0–100) | redistributed in the OpenRouter `benchmarks.artificial_analysis` block; attributed in the UI | API |
| [Design Arena](https://www.designarena.ai) | human-preference Elo per category, rank, win rate | redistributed in `benchmarks.design_arena`; attributed in the UI | API |
| `src/server/ingest/reference.ts` | lab HQ, founding year, website, short description, first-party provider mapping | hand-curated, only well-established facts; unknowns stay null | Curated |

Every field above was checked against live responses before mapping. The Zod schemas in `src/server/ingest/openrouter/schemas.ts` encode the verified shape.

## Field mapping highlights

- `id` → `Model.externalId`; `slug = id` lower-cased with `/ : .` → `-`. A `~` prefix marks moving aliases (`status = ALIAS`, `aliasTargetSlug`).
- `name` "Lab: Model" → the lab prefix is stripped; the family is derived from the words before the first version token (unit-tested rules).
- Lab = id prefix, with aliases merged (`meta-llama` → `meta`, `bytedance-seed` → `bytedance`).
- Pricing: strings in USD per token → numeric USD per 1M tokens (images per image, web search per search). `-1` → variable. `overrides` with `min_prompt_tokens` → long-context tiers. Time-of-day overrides (`utc_days`, `utc_start`) are recognized and skipped; the base price is kept.
- Capabilities from `supported_parameters` (tools, structured_outputs, response_format, reasoning), input/output modalities, priced web search, priced cache reads, context ≥ 200K, Hugging Face id (open weights).
- Type: router (`openrouter/*` or negative price) > embedding > video/image/audio output > reasoning > multimodal input > chat.

## Freshness and provenance

- Each run creates an `IngestionJob` with per-stage timings, counters and up to 200 validation/processing errors. These are visible on `/engine`.
- `DataSource.lastSuccessAt` is updated on success and shown on `/engine` and the benchmarks page.
- Each model page shows its source, first-tracked date, last sync and score computation time.
- Benchmark results carry `observedAt`, the date OneAtlas observed the value (the upstream doesn't publish evaluation dates per score). The UI labels it "observed", not "evaluated".

## Respecting the sources

The ingest identifies itself with a descriptive User-Agent, caps concurrency at 6, honours `Retry-After`, and runs at most once a day in production (Vercel Cron) plus manual runs.

## Not invented

No benchmark scores, prices or histories are fabricated. Where data is missing the UI says so ("not published", hatched meters, "no overall score below 60% coverage"). The schema has `Benchmark.isSynthetic` for clearly labelled demonstration data, but none is loaded.
