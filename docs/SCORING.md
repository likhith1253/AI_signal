# Atlas Intelligence Score — `atlas-v1`

Implementation: [`src/server/scoring/engine.ts`](../src/server/scoring/engine.ts), a pure function with unit tests in `tests/unit/scoring.test.ts`. The `/methodology` page renders these same constants.

The score is a **transparent composite of published data**. It is not an independent evaluation.

## Dimensions (each 0–100, or null when there is no data)

| Dimension | Input | Normalization | Default weight |
|---|---|---|---|
| Capability | AA Intelligence Index | mid-rank percentile among models with the index | 30% |
| Coding | AA Coding Index, else Design Arena code Elo | percentile (fallback is labelled in the trace) | 10% |
| Agentic | AA Agentic Index | percentile | 5% |
| Cost efficiency | cheapest 3:1 blended price | log scale between catalogue p5 (=100) and p95 (=0); free = 100 | 10% |
| Value | capability × cost | geometric mean √(capability · cost) | 15% |
| Context | context window | log₂ scale, 8K = 0 … 1M = 100 | 10% |
| Availability | active providers, best 24h uptime | log₂ reach (10 providers = max) × 85% + uptime × 15% | 10% |
| Versatility | non-text inputs, tools, structured outputs, reasoning | 15 per extra modality (max 45) + 20 + 15 + 20 | 10% |

**Why percentiles?** They put indices and Elo ratings on a comparable footing without pretending they measure the same thing, and they are robust to scale changes upstream.
**Why log price?** Going from $0.10 to $1 matters as much as going from $1 to $10.

## Combining

```
overall  = Σ(scoreᵢ · weightᵢ) / Σ(weightᵢ where scoreᵢ is not null)
coverage = Σ(weightᵢ where scoreᵢ is not null) / Σ(weightᵢ)
overall is published only if coverage ≥ 0.60
```

Missing dimensions are excluded, never treated as zero. The coverage threshold exists because without it, a free model with wide availability and no benchmarks scored in the 90s, ahead of frontier models. Benchmark dimensions carry 45% of the default weight, so no benchmark signal at all means no overall score.

## Custom weights

`/api/rankings?category=overall&weights=capability:0.5,costEfficiency:0.5` (and the weight tuner on `/rankings`) recomputes the composite from stored dimension scores at request time. Weights are normalized; unknown keys are ignored.

## Workload fit

The workload finder uses workload-specific weights and a confidence adjustment:

```
fit = composite(dimensions, workload.weights) × (0.75 + 0.25 × coverage)
```

so a model with complete data beats an equal score with gaps.

## Versioning

Every `ModelScore` row stores `methodology = "atlas-v1"`. A methodology change gets a new version string, and the engine's derive stage recomputes all scores.
