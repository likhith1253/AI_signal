"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";

const DIMS: { key: string; label: string; def: number }[] = [
  { key: "capability", label: "Capability", def: 30 },
  { key: "coding", label: "Coding", def: 10 },
  { key: "agentic", label: "Agentic", def: 5 },
  { key: "value", label: "Value", def: 15 },
  { key: "costEfficiency", label: "Cost efficiency", def: 10 },
  { key: "context", label: "Context", def: 10 },
  { key: "availability", label: "Availability", def: 10 },
  { key: "versatility", label: "Versatility", def: 10 },
];

function parse(raw: string | null) {
  const w: Record<string, number> = Object.fromEntries(DIMS.map((d) => [d.key, d.def]));
  if (!raw) return w;
  const out: Record<string, number> = Object.fromEntries(DIMS.map((d) => [d.key, 0]));
  for (const part of raw.split(",")) {
    const [k, v] = part.split(":");
    if (k in out) out[k] = Math.round(Number(v) * 100) || 0;
  }
  return out;
}

/** Re-weight the Atlas composite; weights travel in the URL so a custom ranking is shareable. */
export function WeightTuner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [w, setW] = useState(() => parse(sp.get("weights")));
  const total = Object.values(w).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const t = setTimeout(() => {
      const isDefault = DIMS.every((d) => w[d.key] === d.def);
      const next = new URLSearchParams(sp.toString());
      if (isDefault) next.delete("weights");
      else next.set("weights", DIMS.filter((d) => w[d.key] > 0).map((d) => `${d.key}:${(w[d.key] / 100).toFixed(2)}`).join(","));
      if (next.toString() !== sp.toString()) start(() => router.replace(`/rankings?${next.toString()}`, { scroll: false }));
    }, 220);
    return () => clearTimeout(t);
  }, [w, sp, router]);

  return (
    <div className="rounded-none border border-line bg-surface p-4" data-testid="weight-tuner">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-medium text-ink">Tune the weights</div>
          <div className="text-[11.5px] text-ink-3">{pending ? "Re-ranking…" : "Rows move as the ranking changes"}</div>
        </div>
        <button onClick={() => setW(Object.fromEntries(DIMS.map((d) => [d.key, d.def])))} className="flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink" title="Reset to atlas-v1 defaults">
          <RotateCcw size={12} /> Reset
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        {DIMS.map((d) => (
          <label key={d.key} className="grid grid-cols-[88px_minmax(0,1fr)_34px] items-center gap-2 text-[12.5px]">
            <span className="text-ink-2">{d.label}</span>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={w[d.key]}
              onChange={(e) => setW((cur) => ({ ...cur, [d.key]: Number(e.target.value) }))}
              className="accent-[var(--copper)]"
              aria-label={`${d.label} weight`}
            />
            <span className="num text-right text-ink">{total ? Math.round((w[d.key] / total) * 100) : 0}%</span>
          </label>
        ))}
      </div>
      <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-3">Shown as share of total. Weights are normalized; dimensions without data are excluded per model.</p>
    </div>
  );
}
