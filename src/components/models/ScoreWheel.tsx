"use client";
import { motion } from "motion/react";
import { useState } from "react";

const SHORT: Record<string, string> = { capability: "Capab.", coding: "Coding", agentic: "Agentic", costEfficiency: "Cost", value: "Value", context: "Context", availability: "Avail.", versatility: "Versat." };

interface Dim {
  key: string;
  label: string;
  score: number | null;
}

/**
 * Atlas score wheel: one petal per dimension, radius ∝ score (0–100).
 * Dimensions without data render as a dashed outline so gaps stay visible.
 */
export function ScoreWheel({ dims, overall, size = 260 }: { dims: Dim[]; overall: number | null; size?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const c = size / 2;
  const inner = size * 0.15;
  const outer = size * 0.36;
  const n = dims.length;
  const gap = 0.05;
  const petal = (i: number, value: number) => {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 + gap;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2 - gap;
    const r = inner + (outer - inner) * (value / 100);
    const p = (a: number, rr: number) => `${(c + Math.cos(a) * rr).toFixed(2)} ${(c + Math.sin(a) * rr).toFixed(2)}`;
    return `M${p(a0, inner)} L${p(a0, r)} A${r} ${r} 0 0 1 ${p(a1, r)} L${p(a1, inner)} A${inner} ${inner} 0 0 0 ${p(a0, inner)} Z`;
  };
  const active = dims.find((d) => d.key === hover);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Atlas score by dimension">
        {[25, 50, 75, 100].map((g) => (
          <circle key={g} cx={c} cy={c} r={inner + (outer - inner) * (g / 100)} fill="none" stroke="var(--contour)" strokeOpacity={0.6} strokeWidth={g % 50 === 0 ? 1 : 0.5} strokeDasharray={g === 100 ? "0" : "2 3"} />
        ))}
        {dims.map((d, i) => (
          <g key={d.key} onMouseEnter={() => setHover(d.key)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
            <path d={petal(i, 100)} fill="transparent" />
            {d.score == null ? (
              <path d={petal(i, 100)} fill="none" stroke="var(--line-strong)" strokeDasharray="3 3" />
            ) : (
              <motion.path
                d={petal(i, d.score)}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: hover && hover !== d.key ? 0.35 : 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 160, damping: 18 }}
                style={{ transformOrigin: `${c}px ${c}px` }}
                fill="var(--copper)"
                fillOpacity={0.35 + (d.score / 100) * 0.55}
                stroke="var(--ink)"
                strokeWidth={0.8}
              />
            )}
            {(() => {
              const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
              const r = outer + 12;
              return (
                <text x={(c + Math.cos(a) * r).toFixed(2)} y={(c + Math.sin(a) * r).toFixed(2)} textAnchor="middle" dominantBaseline="middle" className="fill-ink-3 font-mono text-[9px] uppercase tracking-wider">
                  {SHORT[d.key] ?? d.label}
                </text>
              );
            })()}
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {active ? (
          <>
            <span className="num text-[22px] leading-none text-ink">{active.score == null ? "—" : active.score.toFixed(0)}</span>
            <span className="mt-1 max-w-[70px] text-[10px] leading-tight text-ink-3">{active.label}</span>
          </>
        ) : (
          <>
            <span className="num text-[28px] leading-none text-ink">{overall == null ? "—" : overall.toFixed(1)}</span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-3">Atlas</span>
          </>
        )}
      </div>
    </div>
  );
}
