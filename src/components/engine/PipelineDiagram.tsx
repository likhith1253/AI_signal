"use client";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

export interface StageLog {
  stage: string;
  ms: number;
  in: number;
  out: number;
  note?: string;
}

const STAGE_INFO: Record<string, { title: string; body: string }> = {
  fetch: { title: "Fetch", body: "Pull the model catalogue and provider directory from public APIs." },
  validate: { title: "Validate", body: "Zod schemas reject records missing fields we depend on; rejects are logged on the job." },
  endpoints: { title: "Endpoints", body: "Per-model provider endpoints, fetched with bounded concurrency and backoff." },
  normalize: { title: "Normalize", body: "Ids → slugs, prices → USD/1M, modality + capability derivation, family inference." },
  resolve: { title: "Resolve", body: "One identity per model; dedupe slugs, attach labs, families and providers." },
  diff: { title: "Diff", body: "Compare against the stored catalogue to produce a changeset — the plan." },
  commit: { title: "Commit", body: "Idempotent upserts; price snapshots and ledger events for every observed change." },
  derive: { title: "Derive", body: "Aggregates, benchmark percentiles (one SQL window query) and Atlas scores." },
};

const ORDER = ["fetch", "validate", "endpoints", "normalize", "resolve", "diff", "commit", "derive"];

/** Live diagram of the Atlas Engine, annotated with the latest run's per-stage numbers. */
export function PipelineDiagram({ stages, tables }: { stages: StageLog[]; tables: Record<string, number> }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const byName = new Map(stages.map((s) => [s.stage, s]));
  const total = stages.reduce((a, s) => a + s.ms, 0);
  const shown = ORDER.filter((s) => byName.has(s) || s !== "commit");
  const info = active ? STAGE_INFO[active] : null;

  const layers = [
    ["Registry", tables.model, "models"],
    ["Providers", tables.offering, "offerings"],
    ["Pricing", tables.price, "prices"],
    ["History", tables.snapshot, "snapshots"],
    ["Benchmarks", tables.result, "results"],
    ["Atlas scores", tables.score, "scores"],
    ["Ledger", tables.change, "events"],
  ] as const;

  return (
    <div className="rounded-none border border-line bg-surface">
      <div className="paper-grid overflow-x-auto p-5">
        <div className="flex min-w-[1110px] justify-between items-stretch gap-0">
          {/* sources */}
          <div className="flex w-[122px] shrink-0 flex-col justify-center gap-2 pr-2">
            {["OpenRouter catalogue", "Provider endpoints", "Artificial Analysis", "Design Arena"].map((s) => (
              <div key={s} className="rounded-none border border-line bg-surface px-2 py-1.5 text-[11px] text-ink-2">
                {s}
              </div>
            ))}
          </div>
          {shown.map((name, i) => {
            const s = byName.get(name);
            const share = s && total ? s.ms / total : 0;
            return (
              <div key={name} className="flex items-center">
                <Connector delay={i * 0.25} reduce={!!reduce} />
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  onMouseEnter={() => setActive(name)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(name)}
                  onBlur={() => setActive(null)}
                  className={`relative flex w-[84px] flex-col rounded-none border bg-surface p-2 text-left transition-colors ${active === name ? "border-copper" : "border-line-strong"} ${name === "diff" ? "ring-1 ring-copper/40" : ""}`}
                  data-testid="pipeline-stage"
                >
                  <span className="num text-[9.5px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[12.5px] font-medium text-ink">{STAGE_INFO[name].title}</span>
                  {s ? (
                    <>
                      <span className="num mt-1 text-[11px] text-ink-2">
                        {s.in > 0 ? `${s.in}→` : ""}
                        {s.out}
                      </span>
                      <span className="num text-[10.5px] text-ink-3">{s.ms >= 1000 ? `${(s.ms / 1000).toFixed(1)}s` : `${s.ms}ms`}</span>
                      <span className="mt-1.5 h-[3px] w-full overflow-hidden rounded bg-surface-3">
                        <motion.span className="block h-full bg-copper" initial={{ width: 0 }} animate={{ width: `${Math.max(4, share * 100)}%` }} transition={{ delay: 0.4 + i * 0.05, duration: 0.6 }} />
                      </span>
                    </>
                  ) : (
                    <span className="mt-1 text-[10.5px] text-ink-3">skipped in plan</span>
                  )}
                </motion.button>
              </div>
            );
          })}
          <div className="flex items-center">
            <Connector delay={2} reduce={!!reduce} />
          </div>
          {/* storage layers */}
          <div className="flex w-[176px] shrink-0 flex-col justify-center gap-1">
            {layers.map(([label, n, unit]) => (
              <div key={label} className="flex items-center justify-between rounded-none border border-line bg-surface px-2 py-1 text-[11px]">
                <span className="text-ink-2">{label}</span>
                <span className="num text-ink">
                  {n.toLocaleString("en-US")} <span className="text-ink-3">{unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex min-h-[44px] items-center border-t border-line px-5 py-2.5 text-[12.5px]">
        {info ? (
          <span>
            <span className="font-medium text-ink">{info.title}</span> <span className="text-ink-2">— {info.body}</span>
            {active && byName.get(active)?.note && <span className="num ml-2 text-ink-3">[{byName.get(active)!.note}]</span>}
          </span>
        ) : (
          <span className="text-ink-3">Hover a stage. Numbers are from the most recent applied run; the copper bar is that stage&apos;s share of total runtime ({(total / 1000).toFixed(1)}s).</span>
        )}
      </div>
    </div>
  );
}

function Connector({ delay, reduce }: { delay: number; reduce: boolean }) {
  return (
    <svg width="18" height="12" className="shrink-0" aria-hidden>
      <line x1="0" y1="6" x2="15" y2="6" stroke="var(--line-strong)" strokeWidth="1.2" />
      <path d="M12 2.5 L17 6 L12 9.5" fill="none" stroke="var(--line-strong)" strokeWidth="1.2" />
      {!reduce && (
        <motion.circle r="2" cy="6" fill="var(--copper)" initial={{ cx: 0, opacity: 0 }} animate={{ cx: [0, 15], opacity: [0, 1, 0] }} transition={{ duration: 1.1, delay, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }} />
      )}
    </svg>
  );
}
