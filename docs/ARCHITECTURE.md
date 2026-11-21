# Architecture

OneAtlas is one Next.js application backed by PostgreSQL. It deliberately avoids microservices, queues and extra infrastructure. Its structure comes from how the code is layered, not from the deployment topology.

```
src/
  app/                    routes: Server Component pages + /api route handlers
  components/             UI (shell, models, charts, compare, engine, ledger, ui primitives)
  lib/                    validation (Zod), API envelope + rate limit, formatting, frontier, compare store
  server/
    db/client.ts          Prisma singleton
    ingest/               Atlas Engine
      openrouter/         HTTP client (backoff, bounded concurrency) + Zod schemas of the live API
      normalize.ts        pure normalization functions
      diff.ts             pure changeset computation
      pipeline.ts         staged runner: fetch → validate → normalize → resolve → diff → commit → derive
      derive.ts           aggregates, percentiles (set-based SQL), score materialization
      reference.ts        curated lab metadata, benchmark registry, data sources
    scoring/engine.ts     Atlas score: pure, versioned, returns traces
    recommend/workloads.ts workload profiles + deterministic recommender
    queries/              read models shared by pages and API routes
scripts/ingest.ts         CLI for the engine
```

## The seven layers

1. **Model registry.** `Lab`, `ModelFamily`, `Model`, `Modality`/`ModelModality`, `Capability`/`ModelCapability`. A model has one identity (`externalId` → `slug`) however many providers serve it. Capabilities are stored with the *evidence* that established them (for example `supported_parameters:tools`).
2. **Provider intelligence.** `Provider` and `Offering` (model × provider endpoint) carry their own context cap, max output, quantization, uptime and supported parameters. Offerings that disappear are marked inactive rather than deleted, which preserves their history.
3. **Pricing intelligence.** `Price` rows per offering, component (input, output, cache read/write, reasoning, image, audio, web search, request), unit and context tier. Unknown, free and variable prices are three distinct states. `PriceSnapshot` is append-only history written only on first observation or change.
4. **Benchmark intelligence.** `Benchmark` records scale, category, source and methodology URL. `BenchmarkResult` stores the raw score, the source rank, the percentile within its benchmark and the observation date. Cross-benchmark views use percentiles only.
5. **Atlas Intelligence Score.** `ModelScore` materializes eight dimension scores plus overall and coverage for fast sorting. The trace is recomputed on demand from the same pure function, so what the UI explains is exactly what was stored.
6. **Recommendation and discovery.** Workloads are data (`requires` + `weights`). `recommend()` is a pure function over candidates. A learned or LLM recommender could implement the same input/output contract without touching callers.
7. **Ingestion and provenance.** `DataSource`, `IngestionJob` (status, per-stage timings and counters, capped error list, dry-run and baseline flags) and `ChangeEvent` (the ledger).

## Atlas Engine stages

| Stage | Responsibility | Notes |
|---|---|---|
| fetch | `/models` and `/providers` | public, unauthenticated |
| validate | Zod `safeParse` per record | rejects are logged on the job, never silently dropped |
| endpoints | `/models/{id}/endpoints` per model | 6 in flight, retries with exponential backoff and `Retry-After` |
| normalize | pure mapping to `NormalizedModel` | prices → USD/1M, modalities, capabilities, families, type, status |
| resolve | identity + dedupe | slug collisions are reported, the first record wins |
| diff | changeset vs stored catalogue | `--plan` stops here |
| commit | idempotent upserts | per-model transactions; ledger written unless this is the baseline run |
| derive | aggregates, percentiles, scores | percentiles in one window-function `UPDATE` |

Idempotency: re-running with an unchanged upstream produces an empty changeset (unit-tested), and every write is an upsert keyed on natural identifiers (`externalId`, `(modelId, tag)`, `(offeringId, component, tier)`).

## Key decisions and trade-offs

- **Model vs offering split.** Without it, "which provider is cheapest for model X" or "how much does provider Y mark up" can't be answered without duplicating models. The cost is one more join, which indexes and denormalized aggregates (`minInputPrice`, `blendedPrice`, `providerCount`) on `Model` make cheap for sorting.
- **Denormalized aggregates plus materialized scores.** Sorting 470 models by score or price must not compute aggregates per request. The derive stage owns these columns; they are always recomputable (`npm run derive`).
- **Ledger instead of temporal tables.** An append-only event table is simpler to query ("what changed this week") and makes the "never back-filled" rule obvious. The first run is flagged as the baseline and writes no events, which avoids 470 fake "model added" entries.
- **Percentiles for cross-benchmark comparisons.** Elo and 0–100 indices are not comparable. Every visualization that mixes benchmarks shades by percentile and shows the raw score as text.
- **Coverage threshold.** Weight renormalization alone would let a cheap, widely available model with no benchmarks outrank capable ones. Requiring 60% coverage (benchmarks carry 45% of the default weight) prevents that. I found this failure mode while looking at early results.
- **Pages call queries directly.** Server Components skip an HTTP hop; API routes share the same functions, so the API and the UI cannot disagree.
- **URL as state.** Discovery filters, rankings weights, compare selections and workload constraints all live in the URL, which makes them shareable and back-button friendly. The compare selection is mirrored to localStorage so it follows you across pages.
- **No route-level `loading.tsx`.** In Next 15.5 production builds, a route-level loading boundary made same-route navigations (search-param changes) hang. E2E tests caught it. Loading states now use in-page `<Suspense>` fallbacks plus transition dimming.
- **Deterministic recommendations, no LLM.** Results are reproducible, testable and free to serve; reasons are generated from the same numbers that drive the ranking.
- **Rate limiting** is an in-memory fixed window per instance: adequate for a read-only public API, and isolated so a Redis store can replace it.

## Security

- No secrets are in the repo (`.env*` is ignored apart from `.env.example`).
- `POST /api/ingest` and `/api/cron/ingest` require bearer tokens, compared in constant time; without the variable they return 503 instead of running.
- All query parameters pass Zod schemas with bounds; Prisma parameterizes all SQL, and the two raw queries use tagged templates.
- Errors are logged server-side as JSON; clients get a generic 500 envelope.
- `error.tsx` boundary, `not-found.tsx`, and explicit empty states.
