# Notes

Longer notes on how things work. The README has the short version.

## Code layout

```
src/app/            pages (server components) and /api route handlers
src/components/     UI: shell, models, charts, compare, rankings, engine
src/lib/            zod validation, API helpers, formatting, grid refs, compare store
src/server/ingest/  data pipeline (fetch, validate, normalize, diff, commit, derive)
src/server/scoring/ Atlas score
src/server/recommend/ workload finder
src/server/queries/ database reads used by both pages and API routes
scripts/ingest.ts   CLI for the pipeline
```

Pages call the query functions directly instead of going through HTTP. The API routes use the same functions, so the API and the UI always return the same data.

## Database

The main design decision is keeping a model separate from the places you can run it:

- `Model`: one row per model (`openai/gpt-oss-120b`), whatever the number of providers.
- `Offering`: one row per model × provider endpoint, with its own context limit, quantization and uptime.
- `Price`: one row per offering, price component (input, output, cache read, …) and context tier.

That makes questions like "which provider is cheapest for this model" or "how much does provider X charge above the cheapest option" simple queries.

Other tables:

- `Lab` and `ModelFamily`.
- `Modality`/`ModelModality` and `Capability`/`ModelCapability`. Each capability stores how it was detected, e.g. `supported_parameters:tools`.
- `Provider`.
- `Benchmark` and `BenchmarkResult` (raw score, source rank, percentile).
- `ModelScore`: cached Atlas score dimensions.
- `PriceSnapshot`: price history.
- `DataSource`, `IngestionJob` and `ChangeEvent` (the change log).

Prices are `numeric(18,6)` in USD per 1M tokens. A missing price has no row, `0` means free, and `isVariable` is for routers that pick the price per request. I kept these separate because treating "unknown" as 0 made unpriced models look like the cheapest ones.

Indexes cover every column the models page can sort or filter on. Price, provider count and Atlas score are stored on `Model` so sorting doesn't need joins.

## Data

All data comes from OpenRouter's public API, with no key needed:

- `GET /api/v1/models`: models, pricing, modalities and supported parameters. It also includes Artificial Analysis indices and Design Arena Elo ratings, which is where the benchmark data comes from.
- `GET /api/v1/models/{id}/endpoints`: per-provider prices, limits and uptime. About 450 calls, made 6 at a time with retries.
- `GET /api/v1/providers`: provider details.

Lab info (website, HQ, founding year) is a small hand-written file, `src/server/ingest/reference.ts`.

Things in the upstream data I had to handle:

- Some prices have time-of-day discount windows. These failed validation at first; I now accept them and keep the base price.
- Some models are moving aliases (`~openai/gpt-latest`). They're kept but marked `ALIAS`.
- Artificial Analysis stopped publishing the coding and agentic indices during the project. The coding leaderboard falls back to Design Arena code Elo, and the agentic tab is hidden while there's no data.

## Pipeline

`runIngest()` in `src/server/ingest/pipeline.ts` runs these steps:

1. **fetch**: models and providers.
2. **validate**: zod `safeParse`. Bad records are saved on the job instead of crashing the run.
3. **endpoints**: per-provider offerings.
4. **normalize**: slugs, prices in USD/1M, capabilities, family, type.
5. **resolve**: one record per slug.
6. **diff**: compare with the database. `--plan` stops here and just prints the changes.
7. **commit**: upserts, price snapshots and change log rows.
8. **derive**: cheapest prices, benchmark percentiles (one SQL window query) and Atlas scores.

Running it twice in a row writes nothing the second time (`diff` returns an empty list; there's a unit test for this). The very first run is marked as a baseline so it doesn't log 470 "new model" events. Benchmark changes smaller than 1% aren't logged, because Elo ratings move by a point or two every day.

## Atlas score

`src/server/scoring/engine.ts`. There are eight dimensions, each 0-100:

| Dimension | Input | How | Weight |
|---|---|---|---|
| Capability | AA Intelligence Index | percentile among models that have it | 30% |
| Coding | AA Coding Index, else Design Arena code Elo | percentile | 10% |
| Agentic | AA Agentic Index | percentile | 5% |
| Cost efficiency | cheapest blended price (3:1 in:out) | log scale between p5 and p95 | 10% |
| Value | capability and cost | √(capability × cost) | 15% |
| Context | context window | log₂ from 8K to 1M | 10% |
| Availability | provider count, uptime | log₂ of providers (85%) + uptime (15%) | 10% |
| Versatility | non-text inputs, tools, structured output, reasoning | points per feature | 10% |

Overall = weighted average of the dimensions that have data. Missing ones are skipped, not counted as 0. If less than 60% of the weight has data, there's no overall score. I added that rule after cheap models with no benchmarks were landing near the top.

Percentiles are used so an Elo rating and a 0-100 index can sit in the same score. The rankings page lets you change the weights; the composite is recomputed from the stored dimension scores.

## Deployment

- Vercel for the app, Neon for Postgres (added through the Vercel marketplace).
- `vercel.json` runs `prisma migrate deploy` during the build and schedules `/api/cron/ingest` once a day.
- Environment variables: `DATABASE_URL` (pooled), `DIRECT_URL`, `INGEST_SECRET` and `CRON_SECRET`.
- First data load: `curl -X POST -H "Authorization: Bearer $INGEST_SECRET" https://<app>/api/ingest`.

## Problems I hit

- Filter changes stopped working in production builds but worked in dev. A route-level `loading.tsx` made same-page navigations hang. I found it with the e2e tests and switched to a `<Suspense>` inside the page.
- Percentile updates were one query per row (about 11s). A single `UPDATE … FROM (window function)` brought that to about 2s.
- Hydration errors on the map: Node and Chrome round `Math.log10` slightly differently, so SVG coordinates are rounded to 2 decimals.
- Opening a shared `/compare?models=…` link cleared the selection, because a sync effect ran before the store was filled.
- My network blocks port 5432, so I couldn't migrate Neon from my laptop. Migrations run in the Vercel build and the first load goes through the ingest API.
