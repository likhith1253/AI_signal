"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { ModelDetail } from "@/server/queries/models";
import { cn, fmtPrice, fmtTokens } from "@/lib/format";
import { LabMark } from "../identity/LabMark";
import { Tag } from "../ui/primitives";

type Offering = ModelDetail["offerings"][number];
const price = (o: Offering, c: string) => {
  const p = o.prices.find((x) => x.component === c && x.minPromptTokens === 0);
  return p ? (p.isVariable ? null : p.amount) : null;
};

/**
 * Same model, different terms. Bars are scaled to the most expensive offering;
 * the cheapest one is marked. Inactive endpoints are listed but greyed.
 */
export function ProviderPrices({ offerings }: { offerings: Offering[] }) {
  const [metric, setMetric] = useState<"blended" | "INPUT" | "OUTPUT">("blended");
  const [showInactive, setShowInactive] = useState(false);
  const rows = useMemo(() => {
    const val = (o: Offering) => {
      const i = price(o, "INPUT");
      const out = price(o, "OUTPUT");
      if (metric === "blended") return i != null && out != null ? (3 * i + out) / 4 : null;
      return price(o, metric);
    };
    return offerings
      .filter((o) => showInactive || o.isActive)
      .map((o) => ({ o, v: val(o) }))
      .sort((a, b) => (a.v ?? Infinity) - (b.v ?? Infinity) || (b.o.uptime1d ?? 0) - (a.o.uptime1d ?? 0));
  }, [offerings, metric, showInactive]);
  const max = Math.max(...rows.map((r) => r.v ?? 0), 0.000001);
  const best = rows.find((r) => r.v != null)?.v ?? null;
  const worst = [...rows].reverse().find((r) => r.v != null)?.v ?? null;
  const inactive = offerings.filter((o) => !o.isActive).length;
  const tiered = offerings.some((o) => o.prices.some((p) => p.minPromptTokens > 0));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-md border border-line bg-surface-2 p-0.5 text-[12px]">
          {(
            [
              ["blended", "Blended 3:1"],
              ["INPUT", "Input"],
              ["OUTPUT", "Output"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setMetric(k)} className={cn("relative rounded-[4px] px-2.5 py-1", metric === k ? "text-ink" : "text-ink-3")}>
              {metric === k && <motion.span layoutId="pp-metric" className="absolute inset-0 rounded-[4px] bg-surface shadow-[0_0_0_1px_var(--line)]" />}
              <span className="relative">{l}</span>
            </button>
          ))}
        </div>
        {best != null && worst != null && worst > best && (
          <span className="text-[12px] text-ink-2">
            Spread: <span className="num text-ink">{fmtPrice(best)}</span> → <span className="num text-ink">{fmtPrice(worst)}</span>{" "}
            <span className="text-copper">({Math.round(((worst - best) / best) * 100)}% higher at the most expensive provider)</span>
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
              <th className="py-2 pr-3 font-medium">Provider</th>
              <th className="w-[34%] py-2 pr-3 font-medium">{metric === "blended" ? "Blended" : metric === "INPUT" ? "Input" : "Output"} / 1M</th>
              <th className="py-2 pr-3 font-medium">In / out</th>
              <th className="py-2 pr-3 font-medium">Cache read</th>
              <th className="py-2 pr-3 font-medium">Context</th>
              <th className="py-2 pr-3 font-medium">Quant.</th>
              <th className="py-2 font-medium">Uptime 24h</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, v }, i) => (
              <motion.tr key={o.tag} layout initial={{ opacity: 0 }} animate={{ opacity: o.isActive ? 1 : 0.45 }} transition={{ delay: i * 0.02 }} className="border-b border-line last:border-0" data-testid="offering-row">
                <td className="py-2.5 pr-3">
                  <Link href={`/providers/${o.provider.slug}`} className="flex items-center gap-2 hover:underline">
                    <LabMark slug={o.provider.slug} size={22} />
                    <span className="text-ink">{o.provider.name}</span>
                    {o.tag.includes("/") && <span className="num text-[10.5px] text-ink-3">{o.tag.split("/").slice(1).join("/")}</span>}
                    {o.provider.firstParty && <Tag tone="accent">First-party</Tag>}
                    {!o.isActive && <Tag tone="outline">Inactive</Tag>}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">
                  {v == null ? (
                    <span className="text-ink-3">{o.prices.some((p) => p.isVariable) ? "Variable" : "Not published"}</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="h-[7px] flex-1 overflow-hidden rounded-[2px] bg-surface-3">
                        <motion.span className={cn("block h-full rounded-[2px]", v === best ? "bg-accent" : "bg-ink-3")} initial={{ width: 0 }} animate={{ width: `${Math.max(2, (v / max) * 100)}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                      </span>
                      <span className={cn("num w-[64px] text-right", v === best ? "text-accent" : "text-ink")}>{fmtPrice(v)}</span>
                    </span>
                  )}
                </td>
                <td className="num py-2.5 pr-3 text-ink-2">
                  {fmtPrice(price(o, "INPUT"))} / {fmtPrice(price(o, "OUTPUT"))}
                </td>
                <td className="num py-2.5 pr-3 text-ink-2">{fmtPrice(price(o, "CACHE_READ"))}</td>
                <td className="num py-2.5 pr-3 text-ink-2">{fmtTokens(o.contextLength)}</td>
                <td className="num py-2.5 pr-3 text-ink-2">{o.quantization ?? "—"}</td>
                <td className="num py-2.5 text-ink-2">{o.uptime1d == null ? "—" : `${o.uptime1d.toFixed(1)}%`}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-3">
        <span>
          Provider-level terms. “—” means the provider does not publish that value; it is never treated as zero.
          {tiered && " Some providers charge more above a prompt-length threshold; base tier shown."}
        </span>
        {inactive > 0 && (
          <button onClick={() => setShowInactive((s) => !s)} className="text-accent hover:underline">
            {showInactive ? "Hide" : "Show"} {inactive} inactive
          </button>
        )}
      </div>
    </div>
  );
}
