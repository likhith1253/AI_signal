"use client";
import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { paretoFrontier } from "@/lib/frontier";
import { fmtPrice } from "@/lib/format";
import { markHue } from "../identity/LabMark";

export interface LandscapePoint {
  slug: string;
  name: string;
  lab: string;
  labSlug: string;
  price: number;
  intelligence: number;
}

/**
 * Capability (AA Intelligence Index) vs blended price on a log scale. The
 * Pareto frontier — models nothing else beats on both axes — is drawn as a
 * stepped line. Hover for detail, click to open a model.
 */
export function FrontierChart({ points, height = 360 }: { points: LandscapePoint[]; height?: number }) {
  const router = useRouter();
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<LandscapePoint | null>(null);
  const [onlyFrontier, setOnlyFrontier] = useState(false);
  const W = 760;
  const H = height;
  const pad = { l: 44, r: 16, t: 16, b: 34 };

  const { frontier, frontierSet, xs, ys, ticksX, ticksY } = useMemo(() => {
    const frontier = paretoFrontier(points);
    const frontierSet = new Set(frontier.map((f) => f.slug));
    const lp = points.map((p) => Math.log10(p.price));
    const minX = Math.floor(Math.min(...lp));
    const maxX = Math.ceil(Math.max(...lp));
    const iv = points.map((p) => p.intelligence);
    const minY = Math.max(0, Math.floor(Math.min(...iv) / 10) * 10);
    const maxY = Math.ceil(Math.max(...iv) / 10) * 10;
    const xs = (price: number) => pad.l + ((Math.log10(price) - minX) / (maxX - minX || 1)) * (W - pad.l - pad.r);
    const ys = (v: number) => H - pad.b - ((v - minY) / (maxY - minY || 1)) * (H - pad.t - pad.b);
    const ticksX: number[] = [];
    for (let e = minX; e <= maxX; e++) ticksX.push(10 ** e);
    const ticksY: number[] = [];
    for (let v = minY; v <= maxY; v += 10) ticksY.push(v);
    return { frontier, frontierSet, xs, ys, ticksX, ticksY };
  }, [points, H, pad.l, pad.r, pad.t, pad.b]);

  if (points.length < 3) return <div className="py-10 text-center text-[13px] text-ink-3">Not enough priced, benchmarked models to plot.</div>;

  const stepPath = frontier
    .map((f, i) => {
      const x = xs(f.price);
      const y = ys(f.intelligence);
      if (i === 0) return `M${x} ${y}`;
      return `H${x} V${y}`;
    })
    .join(" ");

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[11.5px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <svg width="18" height="8">
            <path d="M0 6 H8 V2 H18" stroke="var(--copper)" strokeWidth="1.6" fill="none" />
          </svg>
          Pareto frontier ({frontier.length} models)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ink-3" /> Each point = one model, coloured by lab
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={onlyFrontier} onChange={(e) => setOnlyFrontier(e.target.checked)} className="accent-[var(--accent)]" />
          Frontier only
        </label>
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Capability versus price scatter plot with Pareto frontier">
        {ticksY.map((t) => (
          <g key={`y${t}`}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(t)} y2={ys(t)} stroke="var(--grid-line)" />
            <text x={pad.l - 8} y={ys(t)} textAnchor="end" dominantBaseline="middle" className="fill-ink-3 font-mono text-[10px]">
              {t}
            </text>
          </g>
        ))}
        {ticksX.map((t) => (
          <g key={`x${t}`}>
            <line x1={xs(t)} x2={xs(t)} y1={pad.t} y2={H - pad.b} stroke="var(--grid-line)" />
            <text x={xs(t)} y={H - pad.b + 16} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">
              {fmtPrice(t)}
            </text>
          </g>
        ))}
        <text x={W - pad.r} y={H - 4} textAnchor="end" className="fill-ink-3 text-[10px]">
          blended USD / 1M tokens (log) →
        </text>
        <text x={pad.l} y={10} className="fill-ink-3 text-[10px]">
          ↑ AA Intelligence Index
        </text>
        <motion.path d={stepPath} fill="none" stroke="var(--copper)" strokeWidth={1.8} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeInOut" }} />
        {points.map((p, i) => {
          const on = frontierSet.has(p.slug);
          if (onlyFrontier && !on) return null;
          const [dark] = markHue(p.labSlug);
          const isHover = hover?.slug === p.slug;
          return (
            <motion.circle
              key={p.slug}
              cx={xs(p.price)}
              cy={ys(p.intelligence)}
              r={isHover ? 7 : on ? 5 : 3.6}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: hover && !isHover ? 0.35 : on ? 1 : 0.75, scale: 1 }}
              transition={{ delay: Math.min(0.6, i * 0.004), duration: 0.3 }}
              fill={on ? "var(--copper)" : dark}
              stroke={on || isHover ? "var(--surface)" : "none"}
              strokeWidth={1.5}
              style={{ cursor: "pointer", transformOrigin: `${xs(p.price)}px ${ys(p.intelligence)}px` }}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              onClick={() => router.push(`/models/${p.slug}`)}
            >
              <title>{`${p.name} — ${p.intelligence} @ ${fmtPrice(p.price)}`}</title>
            </motion.circle>
          );
        })}
        {frontier.slice(-4).map((f) => (
          <text key={`lbl-${f.slug}`} x={xs(f.price) - 6} y={ys(f.intelligence) - 9} textAnchor="end" className="pointer-events-none fill-ink-2 text-[10px]">
            {f.name.length > 22 ? `${f.name.slice(0, 21)}…` : f.name}
          </text>
        ))}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-line-strong bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow)]"
          style={{ left: `${(xs(hover.price) / W) * 100}%`, top: `${(ys(hover.intelligence) / H) * 100}%`, transform: "translate(12px, -110%)" }}
        >
          <div className="font-medium text-ink">{hover.name}</div>
          <div className="text-ink-3">{hover.lab}</div>
          <div className="num mt-1 text-ink-2">
            Index {hover.intelligence} · {fmtPrice(hover.price)}/M {frontierSet.has(hover.slug) && <span className="text-copper">· frontier</span>}
          </div>
        </div>
      )}
    </div>
  );
}
