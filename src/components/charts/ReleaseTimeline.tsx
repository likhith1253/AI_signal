"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { fmtDate } from "@/lib/format";

interface Item {
  slug: string;
  name: string;
  releasedAt: string | null;
  family: string;
  score: number | null;
}

/** One swim-lane per model family; each release is a mark on the time axis (size ∝ Atlas score). */
export function ReleaseTimeline({ models }: { models: Item[] }) {
  const router = useRouter();
  const [hover, setHover] = useState<Item | null>(null);
  const items = models.filter((m) => m.releasedAt);
  const { lanes, t0, t1 } = useMemo(() => {
    const byFam = new Map<string, Item[]>();
    for (const m of items) byFam.set(m.family, [...(byFam.get(m.family) ?? []), m]);
    const lanes = [...byFam.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
    const ts = items.map((m) => new Date(m.releasedAt!).getTime());
    return { lanes, t0: Math.min(...ts), t1: Math.max(...ts) };
  }, [items]);
  if (items.length < 2) return <p className="text-[12.5px] text-ink-3">Not enough dated releases to draw a timeline.</p>;
  const W = 720;
  const laneH = 30;
  const left = 110;
  const H = lanes.length * laneH + 28;
  const x = (iso: string) => left + ((new Date(iso).getTime() - t0) / (t1 - t0 || 1)) * (W - left - 16);
  const years: number[] = [];
  for (let y = new Date(t0).getUTCFullYear(); y <= new Date(t1).getUTCFullYear() + 1; y++) years.push(y);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Release timeline by family">
        {years.map((y) => {
          const t = Date.UTC(y, 0, 1);
          if (t < t0 || t > t1) return null;
          const xx = left + ((t - t0) / (t1 - t0 || 1)) * (W - left - 16);
          return (
            <g key={y}>
              <line x1={xx} x2={xx} y1={0} y2={H - 20} stroke="var(--line)" strokeDasharray="2 3" />
              <text x={xx} y={H - 6} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">
                {y}
              </text>
            </g>
          );
        })}
        {lanes.map(([fam, list], li) => (
          <g key={fam}>
            <text x={0} y={li * laneH + laneH / 2 + 4} className="fill-ink-2 text-[11px]">
              {fam.length > 15 ? `${fam.slice(0, 14)}…` : fam}
            </text>
            <line x1={left} x2={W - 16} y1={li * laneH + laneH / 2} y2={li * laneH + laneH / 2} stroke="var(--line)" />
            {list.map((m, i) => (
              <motion.circle
                key={m.slug}
                cx={x(m.releasedAt!)}
                cy={li * laneH + laneH / 2}
                r={m.score == null ? 3.5 : 3 + (m.score / 100) * 5}
                fill={m.score == null ? "var(--surface)" : "var(--accent)"}
                stroke={m.score == null ? "var(--ink-3)" : "var(--surface)"}
                strokeWidth={1.2}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.03 + li * 0.05 }}
                style={{ cursor: "pointer", transformOrigin: `${x(m.releasedAt!)}px ${li * laneH + laneH / 2}px` }}
                onMouseEnter={() => setHover(m)}
                onMouseLeave={() => setHover(null)}
                onClick={() => router.push(`/models/${m.slug}`)}
              />
            ))}
          </g>
        ))}
      </svg>
      <div className="mt-1 h-5 text-[12px] text-ink-2">
        {hover ? (
          <>
            <span className="text-ink">{hover.name}</span> · {fmtDate(hover.releasedAt)} {hover.score != null && `· Atlas ${hover.score.toFixed(1)}`}
          </>
        ) : (
          <span className="text-ink-3">Filled marks have an Atlas score (size ∝ score). Hover for detail, click to open.</span>
        )}
      </div>
    </div>
  );
}
