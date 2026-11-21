"use client";
import { useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { contourDensity } from "d3-contour";
import { Delaunay } from "d3-delaunay";
import { DATUM, gridRef, project } from "@/lib/gridref";
import { paretoFrontier } from "@/lib/frontier";
import { fmtPrice } from "@/lib/format";
import { markHue } from "../identity/LabMark";

export interface TerrainPoint {
  slug: string;
  name: string;
  lab: string;
  labSlug: string;
  price: number;
  intelligence: number;
}

const W = 1000;
const H = 620;
const M = { l: 46, r: 18, t: 22, b: 40 };
const IW = W - M.l - M.r;
const IH = H - M.t - M.b;
// rounded: Node and browsers disagree in the last float digits of log10, which breaks hydration
const r2 = (n: number) => Math.round(n * 100) / 100;
const sx = (u: number) => r2(M.l + u * IW);
/** GeoJSON MultiPolygon (already in pixel space) → SVG path. Avoids pulling in d3-geo. */
const ringsToPath = (coords: number[][][][]) =>
  coords.map((poly) => poly.map((ring) => `M${ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`).join("")).join("");
const sy = (v: number) => r2(M.t + v * IH);

/**
 * The terrain of machine intelligence. Every benchmarked, priced model is a
 * survey station on the OneAtlas datum (log price × AA Intelligence Index).
 * Contours are a kernel-density estimate of where models cluster: hills are
 * crowded market segments, open ground is where nobody competes. The red ridge
 * is the Pareto frontier.
 */
export function TopoMap({ points, compact = false, highlight }: { points: TerrainPoint[]; compact?: boolean; highlight?: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<(TerrainPoint & { x: number; y: number }) | null>(null);

  const geo = useMemo(() => {
    const placed = points.map((p) => {
      const { u, v } = project(p.price, p.intelligence);
      return { ...p, x: sx(u), y: sy(v) };
    });
    const density = contourDensity<(typeof placed)[number]>()
      .x((d) => d.x)
      .y((d) => d.y)
      .size([W, H])
      .bandwidth(compact ? 34 : 30)
      .thresholds(compact ? 9 : 16)(placed);
    const contours = density.map((c, i) => ({ d: ringsToPath(c.coordinates as number[][][][]), i, index: i % 4 === 3 }));
    const frontier = paretoFrontier(points).map((f) => {
      const { u, v } = project(f.price, f.intelligence);
      return { ...f, x: sx(u), y: sy(v) };
    });
    const frontierSet = new Set(frontier.map((f) => f.slug));
    // greedy label placement: try left, right, below; skip a label that would collide
    const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const labels: { slug: string; text: string; lx: number; ly: number; anchor: "start" | "end" }[] = [];
    for (const f of [...frontier].reverse()) {
      const text = f.name.length > 24 ? `${f.name.slice(0, 23)}…` : f.name;
      const w = text.length * 6.2;
      const options = [
        { lx: f.x - 9, ly: f.y - 7, anchor: "end" as const, x0: f.x - 9 - w, x1: f.x - 9 },
        { lx: f.x + 9, ly: f.y + 4, anchor: "start" as const, x0: f.x + 9, x1: f.x + 9 + w },
        { lx: f.x - 9, ly: f.y + 16, anchor: "end" as const, x0: f.x - 9 - w, x1: f.x - 9 },
      ];
      for (const o of options) {
        const box = { x0: o.x0, x1: o.x1, y0: o.ly - 12, y1: o.ly + 3 };
        if (box.x0 < M.l + 4 || box.x1 > W - M.r - 4) continue;
        if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
        boxes.push(box);
        labels.push({ slug: f.slug, text, lx: o.lx, ly: o.ly, anchor: o.anchor });
        break;
      }
      if (labels.length >= 6) break;
    }
    const delaunay = Delaunay.from(placed, (d) => d.x, (d) => d.y);
    return { placed, contours, frontier, frontierSet, delaunay, labels };
  }, [points, compact]);

  const ridge = geo.frontier.map((f, i) => `${i ? "L" : "M"}${f.x} ${f.y}`).join(" ");

  const toSvg = (e: React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const onMove = (e: React.MouseEvent) => {
    const p = toSvg(e);
    if (p.x < M.l || p.x > W - M.r || p.y < M.t || p.y > H - M.b) {
      setCursor(null);
      setHover(null);
      return;
    }
    setCursor(p);
    const i = geo.delaunay.find(p.x, p.y);
    const n = geo.placed[i];
    setHover(n && Math.hypot(n.x - p.x, n.y - p.y) < 26 ? n : null);
  };

  // cursor readout in datum units
  const readout = cursor
    ? (() => {
        const u = (cursor.x - M.l) / IW;
        const v = (cursor.y - M.t) / IH;
        const price = 10 ** (Math.log10(DATUM.priceMin) + u * (Math.log10(DATUM.priceMax) - Math.log10(DATUM.priceMin)));
        const intel = DATUM.intelMax - v * (DATUM.intelMax - DATUM.intelMin);
        return { price, intel, ref: gridRef(price, intel) };
      })()
    : null;

  const colW = IW / DATUM.cols.length;
  const rowH = IH / DATUM.rows;
  const hl = highlight ? geo.placed.find((p) => p.slug === highlight) : null;

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        onMouseMove={onMove}
        onMouseLeave={() => {
          setCursor(null);
          setHover(null);
        }}
        onClick={() => hover && router.push(`/models/${hover.slug}`)}
        style={{ cursor: hover ? "pointer" : cursor ? "crosshair" : "default" }}
        role="img"
        aria-label={`Topographic map of ${points.length} AI models by price and intelligence, with the cost-to-capability frontier`}
        data-testid="topo-map"
      >
        <defs>
          <clipPath id="sheet">
            <rect x={M.l} y={M.t} width={IW} height={IH} />
          </clipPath>
          <pattern id="marsh" width="14" height="8" patternUnits="userSpaceOnUse">
            <path d="M2 6 h4 M8 3 h4" stroke="var(--line-strong)" strokeWidth="0.8" />
          </pattern>
        </defs>

        {/* sheet + grid squares */}
        <rect x={M.l} y={M.t} width={IW} height={IH} fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.2" />
        {!compact && (
          <rect x={sx(0.5)} y={sy(0.5)} width={IW / 2} height={IH / 2} fill="url(#marsh)" opacity="0.6" clipPath="url(#sheet)" />
        )}
        {DATUM.cols.map((c, i) => (
          <g key={c}>
            {i > 0 && <line x1={M.l + i * colW} x2={M.l + i * colW} y1={M.t} y2={H - M.b} stroke="var(--grid-line)" strokeWidth="1" />}
            {!compact && (
              <text x={M.l + i * colW + colW / 2} y={M.t - 7} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">
                {c}
              </text>
            )}
          </g>
        ))}
        {Array.from({ length: DATUM.rows }).map((_, i) => (
          <g key={i}>
            {i > 0 && <line x1={M.l} x2={W - M.r} y1={M.t + i * rowH} y2={M.t + i * rowH} stroke="var(--grid-line)" strokeWidth="1" />}
            {!compact && (
              <text x={W - M.r + 9} y={M.t + i * rowH + rowH / 2 + 3} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">
                {i + 1}
              </text>
            )}
          </g>
        ))}

        {/* contours */}
        <g clipPath="url(#sheet)">
          {geo.contours.map((c) => (
            <motion.path
              key={c.i}
              d={c.d}
              fill="var(--contour)"
              fillOpacity={0.035}
              stroke="var(--contour)"
              strokeWidth={c.index ? 1.25 : 0.6}
              strokeOpacity={c.index ? 0.9 : 0.6}
              initial={reduce ? false : { pathLength: 0, fillOpacity: 0 }}
              animate={{ pathLength: 1, fillOpacity: 0.035 }}
              transition={{ delay: 0.15 + c.i * 0.07, duration: 1.1, ease: "easeInOut" }}
            />
          ))}
        </g>

        {/* region names, lettered like physical features */}
        {!compact && (
          <g className="pointer-events-none">
            {[
              { t: "Value highlands", x: sx(0.04), y: sy(0.08), a: "start" },
              { t: "Premium summit", x: sx(0.96), y: sy(0.08), a: "end" },
              { t: "Budget lowlands", x: sx(0.04), y: sy(0.95), a: "start" },
              { t: "Costly shallows", x: sx(0.96), y: sy(0.95), a: "end" },
            ].map((r) => (
              <text key={r.t} x={r.x} y={r.y} textAnchor={r.a as "start" | "end"} className="fill-ink-3 font-serif text-[15px] italic" letterSpacing="2">
                {r.t}
              </text>
            ))}
          </g>
        )}

        {/* frontier ridge */}
        <motion.path
          d={ridge}
          fill="none"
          stroke="var(--copper)"
          strokeWidth={compact ? 1.4 : 2}
          strokeDasharray="7 4"
          clipPath="url(#sheet)"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 1.0, duration: 1.4, ease: "easeInOut" }}
        />

        {/* stations */}
        {geo.placed.map((p, i) => {
          const on = geo.frontierSet.has(p.slug);
          const isHover = hover?.slug === p.slug;
          const isHl = hl?.slug === p.slug;
          const [ink] = markHue(p.labSlug);
          const s = isHover || isHl ? 7 : on ? 5.2 : compact ? 2.6 : 3.6;
          return (
            <motion.path
              key={p.slug}
              d={`M${p.x} ${p.y - s} L${p.x + s * 0.9} ${p.y + s * 0.65} H${p.x - s * 0.9} Z`}
              fill={on || isHl ? "var(--copper)" : compact ? "var(--ink-3)" : ink}
              stroke={on || isHover || isHl ? "var(--surface)" : "none"}
              strokeWidth={1}
              opacity={hl && !isHl ? 0.35 : 1}
              initial={reduce ? false : { opacity: 0, scale: 0 }}
              animate={{ opacity: hl && !isHl ? 0.35 : 1, scale: 1 }}
              transition={{ delay: 0.7 + (i % 40) * 0.012, duration: 0.25 }}
              style={{ transformOrigin: `${p.x}px ${p.y}px` }}
            />
          );
        })}

        {/* frontier labels */}
        {!compact &&
          geo.labels.map((l) => (
            <text key={`l-${l.slug}`} x={l.lx} y={l.ly} textAnchor={l.anchor} className="pointer-events-none fill-ink font-serif text-[13px] italic">
              {l.text}
            </text>
          ))}
        {hl && (
          <g className="pointer-events-none">
            <circle cx={hl.x} cy={hl.y} r={16} fill="none" stroke="var(--copper)" strokeWidth="1.2" />
            <circle cx={hl.x} cy={hl.y} r={26} fill="none" stroke="var(--copper)" strokeWidth="0.6" strokeDasharray="2 3" />
          </g>
        )}

        {/* axes */}
        {[0.01, 0.1, 1, 10, 100].map((t) => {
          const x = sx(project(t, 0).u);
          return (
            <g key={t}>
              <line x1={x} x2={x} y1={H - M.b} y2={H - M.b + 5} stroke="var(--ink)" />
              <text x={x} y={H - M.b + 17} textAnchor="middle" className="fill-ink-2 font-mono text-[10.5px]">
                {fmtPrice(t)}
              </text>
            </g>
          );
        })}
        {[0, 20, 40, 60, 80].map((t) => {
          const y = sy(project(1, t).v);
          return (
            <g key={t}>
              <line x1={M.l - 5} x2={M.l} y1={y} y2={y} stroke="var(--ink)" />
              <text x={M.l - 9} y={y + 3.5} textAnchor="end" className="fill-ink-2 font-mono text-[10.5px]">
                {t}
              </text>
            </g>
          );
        })}
        {!compact && (
          <>
            <text x={W - M.r} y={H - 6} textAnchor="end" className="fill-ink-3 font-sans text-[11px] uppercase" letterSpacing="1.5">
              Blended price, USD per 1M tokens (log) →
            </text>
            <text x={M.l} y={H - 6} className="fill-ink-3 font-sans text-[11px] uppercase" letterSpacing="1.5">
              ↑ AA Intelligence Index
            </text>
            {/* north arrow: north is capability */}
            <g transform={`translate(${M.l + 30} ${M.t + 64})`} className="pointer-events-none">
              <circle r="17" fill="var(--surface)" stroke="var(--ink)" strokeWidth="0.8" />
              <path d="M0 -14 L5 4 L0 0 L-5 4 Z" fill="var(--ink)" />
              <text y="-21" textAnchor="middle" className="fill-ink font-sans text-[10px] font-semibold">
                N
              </text>
            </g>
          </>
        )}

        {/* crosshair */}
        {cursor && (
          <g className="pointer-events-none">
            <line x1={cursor.x} x2={cursor.x} y1={M.t} y2={H - M.b} stroke="var(--ink-2)" strokeWidth="0.6" strokeDasharray="3 3" />
            <line x1={M.l} x2={W - M.r} y1={cursor.y} y2={cursor.y} stroke="var(--ink-2)" strokeWidth="0.6" strokeDasharray="3 3" />
          </g>
        )}
      </svg>

      {/* readout + hover card */}
      {!compact && (
        <div className="num pointer-events-none absolute right-6 top-8 hidden border border-ink bg-surface px-2.5 py-1.5 text-[10.5px] text-ink-2 md:block">
          {readout ? (
            <>
              <div>
                ref <span className="text-copper">{readout.ref}</span>
              </div>
              <div>
                {fmtPrice(readout.price)}/M · idx {readout.intel.toFixed(1)}
              </div>
            </>
          ) : (
            <div>hover the sheet</div>
          )}
        </div>
      )}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[240px] border border-ink bg-surface px-3 py-2 shadow-[var(--shadow)]"
          style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`, transform: hover.x > W * 0.7 ? "translate(calc(-100% - 14px), -50%)" : "translate(14px, -50%)" }}
        >
          <div className="text-[13.5px] font-semibold text-ink">{hover.name}</div>
          <div className="water text-[12px] text-ink-3">{hover.lab}</div>
          <div className="num mt-1 text-[10.5px] text-ink-2">
            ref {gridRef(hover.price, hover.intelligence)} · idx {hover.intelligence} · {fmtPrice(hover.price)}/M
          </div>
          {geo.frontierSet.has(hover.slug) && <div className="letter mt-1 text-[10px] font-semibold text-copper">On the frontier ridge</div>}
        </div>
      )}
    </div>
  );
}
