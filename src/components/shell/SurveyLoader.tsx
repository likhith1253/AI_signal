"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Delaunay } from "d3-delaunay";
import { LogoMark } from "./Logo";

const KEY = "oneatlas.surveyed";
const DURATION = 2300;

/** Seeded PRNG so the triangulation is identical on every visit: it is our survey, not noise. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** First-visit loader animation. Plays once per session; click or Esc skips it. */
export function SurveyLoader() {
  const [show, setShow] = useState(true);
  const [count, setCount] = useState(0);

  const { points, edges } = useMemo(() => {
    const rnd = mulberry32(476);
    const pts: [number, number][] = [[500, 300]];
    while (pts.length < 54) {
      const x = 40 + rnd() * 920;
      const y = 40 + rnd() * 520;
      if (pts.every(([px, py]) => Math.hypot(px - x, py - y) > 62)) pts.push([x, y]);
    }
    const d = Delaunay.from(pts);
    const seen = new Set<string>();
    const e: { a: [number, number]; b: [number, number]; dist: number }[] = [];
    const t = d.triangles;
    for (let i = 0; i < t.length; i += 3) {
      for (const [p, q] of [
        [t[i], t[i + 1]],
        [t[i + 1], t[i + 2]],
        [t[i + 2], t[i]],
      ]) {
        const k = p < q ? `${p}-${q}` : `${q}-${p}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const a = pts[p];
        const b = pts[q];
        e.push({ a, b, dist: Math.hypot((a[0] + b[0]) / 2 - 500, (a[1] + b[1]) / 2 - 300) });
      }
    }
    e.sort((x, y) => x.dist - y.dist);
    return { points: pts, edges: e };
  }, []);

  useEffect(() => {
    if (document.documentElement.dataset.surveyed) {
      setShow(false);
      return;
    }
    const finish = () => {
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {}
      document.documentElement.dataset.surveyed = "1";
      setShow(false);
    };
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / (DURATION - 400));
      setCount(Math.round(476 * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = setTimeout(finish, DURATION);
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape" && e.key !== "Enter" && e.key !== " ") return;
      finish();
    };
    window.addEventListener("keydown", skip);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          id="survey-loader"
          className="paper-grid fixed inset-0 z-[90] flex cursor-pointer items-center justify-center overflow-hidden bg-bg"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
          onClick={() => {
            try {
              sessionStorage.setItem(KEY, "1");
            } catch {}
            document.documentElement.dataset.surveyed = "1";
            setShow(false);
          }}
          role="status"
          aria-label="Loading OneAtlas"
        >
          <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
            {edges.map((e, i) => (
              <motion.line
                key={i}
                x1={e.a[0]}
                y1={e.a[1]}
                x2={e.b[0]}
                y2={e.b[1]}
                stroke="var(--contour)"
                strokeWidth={0.8}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.75 }}
                transition={{ delay: 0.15 + (i / edges.length) * 1.4, duration: 0.35, ease: "easeOut" }}
              />
            ))}
            {points.map(([x, y], i) => {
              const delay = 0.05 + (Math.hypot(x - 500, y - 300) / 580) * 1.4;
              return (
                <motion.g key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.25 }} style={{ transformOrigin: `${x}px ${y}px` }}>
                  <path d={`M${x} ${y - 5} L${x + 4.6} ${y + 3.5} H${x - 4.6} Z`} fill={i === 0 ? "var(--copper)" : "none"} stroke="var(--copper)" strokeWidth="1" />
                  {i % 7 === 0 && (
                    <text x={x + 8} y={y + 3} className="fill-ink-3 font-mono text-[8px]">
                      {`${(x / 10).toFixed(1)}·${(y / 10).toFixed(1)}`}
                    </text>
                  )}
                </motion.g>
              );
            })}
          </svg>
          <motion.div className="relative flex flex-col items-center border border-ink bg-bg px-8 py-6 text-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
            <LogoMark size={44} />
            <div className="font-display mt-3 text-[30px] font-bold leading-none tracking-[0.18em] text-ink">OneAtlas</div>
            <div className="water mt-1 text-[13px] text-ink-2">a survey of machine intelligence</div>
            <div className="num mt-4 text-[11px] text-ink-3">
              triangulating <span className="text-copper">{String(count).padStart(3, "0")}</span> stations
            </div>
            <div className="mt-2 flex h-[5px] w-48 border border-ink">
              <motion.span className="block h-full bg-ink" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: (DURATION - 400) / 1000, ease: [0.33, 1, 0.68, 1] }} />
            </div>
            <div className="letter mt-3 text-[9.5px] text-ink-3">click to skip</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
