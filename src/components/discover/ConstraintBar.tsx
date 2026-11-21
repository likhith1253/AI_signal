"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/format";

const PRICES = [null, "0.5", "2", "10"];
const CONTEXTS = [null, "128000", "200000", "1000000"];

export function ConstraintBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    start(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  };
  const chip = (k: string, v: string | null, label: string) => {
    const on = (sp.get(k) ?? null) === v;
    return (
      <button key={label} onClick={() => set(k, v)} aria-pressed={on} className={cn("num h-7 rounded-[4px] border px-2 text-[12px]", on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-line-strong")}>
        {label}
      </button>
    );
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 transition-opacity", pending && "opacity-60")} data-testid="constraints">
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-[12px] text-ink-3">Max blended</span>
        {PRICES.map((p) => chip("maxPrice", p, p ? `$${p}` : "Any"))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-[12px] text-ink-3">Min context</span>
        {CONTEXTS.map((c) => chip("minContext", c, c ? `${Number(c) >= 1e6 ? "1M" : `${Number(c) / 1000}K`}` : "Any"))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-2">
        <input type="checkbox" checked={sp.get("openWeights") === "1"} onChange={(e) => set("openWeights", e.target.checked ? "1" : null)} className="accent-[var(--accent)]" />
        Open weights only
      </label>
    </div>
  );
}
