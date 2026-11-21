"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { RankingRow } from "@/server/queries/intelligence";
import { fmtPrice, fmtRelative, fmtTokens } from "@/lib/format";
import { LabMark } from "../identity/LabMark";
import { CapabilityIcons, TypeTag } from "../models/bits";
import { CompareButton } from "../models/CompareButton";
import { Meter } from "../ui/primitives";

/** Rows are keyed by model, so re-weighting animates each model to its new rank. */
export function RankingTable({ rows, scaleMax }: { rows: RankingRow[]; scaleMax?: number }) {
  const max = scaleMax ?? Math.max(...rows.map((r) => r.value), 1);
  const min = Math.min(...rows.map((r) => r.value), 0);
  const isElo = rows[0]?.display && rows[0].value > 200 && rows[0].origin === "external";
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="hidden grid-cols-[48px_minmax(0,1fr)_200px_110px_90px_36px] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3 md:grid">
        <span>Rank</span>
        <span>Model</span>
        <span>Score</span>
        <span>Blended / 1M</span>
        <span>Context</span>
        <span />
      </div>
      <ul data-testid="ranking-table">
        <AnimatePresence initial={false}>
          {rows.map((r) => {
            const pct = isElo ? ((r.value - min) / (max - min || 1)) * 100 : (r.value / max) * 100;
            return (
              <motion.li
                key={r.model.slug}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ layout: { type: "spring", stiffness: 300, damping: 34 }, opacity: { duration: 0.2 } }}
                className="border-b border-line bg-surface last:border-0"
              >
                <Link href={`/models/${r.model.slug}`} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 hover:bg-surface-2 md:grid-cols-[48px_minmax(0,1fr)_200px_110px_90px_36px]">
                  <span className={`num text-[15px] ${r.rank <= 3 ? "text-copper" : "text-ink-3"}`}>{String(r.rank).padStart(2, "0")}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <LabMark slug={r.model.lab.slug} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{r.model.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-3">
                        <span className="truncate">{r.model.lab.name}</span>
                        <span className="hidden sm:inline-flex">
                          <TypeTag type={r.model.type} />
                        </span>
                        <span className="hidden lg:inline-flex">
                          <CapabilityIcons caps={r.model.capabilities} max={4} />
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="hidden w-full md:block">
                      <Meter value={pct} tone={r.origin === "derived" ? "copper" : "accent"} />
                    </span>
                    <span className="num w-14 text-right text-[14px] text-ink">{r.display}</span>
                    {r.confidence != null && r.confidence < 1 && <span className="num hidden text-[10px] text-ink-3 xl:inline" title="Share of score weight backed by data">{Math.round(r.confidence * 100)}%</span>}
                  </span>
                  <span className="num hidden text-[12.5px] text-ink-2 md:block">{r.model.pricing.isFree && !r.model.pricing.blended ? "Free" : fmtPrice(r.model.pricing.blended)}</span>
                  <span className="num hidden text-[12.5px] text-ink-2 md:block">{fmtTokens(r.model.contextLength)}</span>
                  <span className="hidden md:block">
                    <CompareButton slug={r.model.slug} name={r.model.name} lab={r.model.lab.slug} />
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {rows[0] && (
        <div className="border-t border-line px-4 py-2 text-[11px] text-ink-3">
          Source: {rows[0].source} · observed {fmtRelative(rows[0].observedAt)}
        </div>
      )}
    </div>
  );
}
