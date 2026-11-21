"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownUp, ChevronLeft, ChevronRight, LayoutGrid, Rows3, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ModelCard } from "@/server/queries/models";
import { cn, fmtMonth, fmtTokens, TYPE_LABELS } from "@/lib/format";
import { LabMark } from "../identity/LabMark";
import { CapabilityIcons, ModalityStrip, PriceCell, ScoreDial, TypeTag } from "./bits";
import { CompareButton } from "./CompareButton";
import { useQueryState } from "./useQueryState";
import { EmptyState } from "../ui/EmptyState";
import { capabilityLabel } from "./bits";

const SORTS = [
  { value: "score", label: "Atlas score" },
  { value: "newest", label: "Newest" },
  { value: "blended", label: "Blended price" },
  { value: "input", label: "Input price" },
  { value: "output", label: "Output price" },
  { value: "context", label: "Context window" },
  { value: "providers", label: "Provider count" },
  { value: "name", label: "Name" },
];

const VIEW_KEY = "oneatlas.models.view";

export function ActiveFilters({ labels }: { labels: Record<string, string> }) {
  const { sp, update, getList } = useQueryState();
  const chips: { key: string; value?: string; label: string }[] = [];
  for (const key of ["type", "capability", "modality", "lab", "provider"]) {
    for (const v of getList(key)) chips.push({ key, value: v, label: key === "type" ? TYPE_LABELS[v] ?? v : key === "capability" ? capabilityLabel(v) : key === "modality" ? `${v} input` : labels[`${key}:${v}`] ?? v });
  }
  if (sp.get("q")) chips.push({ key: "q", label: `“${sp.get("q")}”` });
  if (sp.get("maxPrice")) chips.push({ key: "maxPrice", label: `≤ $${sp.get("maxPrice")}/M` });
  if (sp.get("minContext")) chips.push({ key: "minContext", label: `${fmtTokens(Number(sp.get("minContext")))}+ context` });
  if (sp.get("free")) chips.push({ key: "free", label: "Free" });
  if (sp.get("openWeights")) chips.push({ key: "openWeights", label: "Open weights" });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="active-filters">
      <AnimatePresence initial={false}>
        {chips.map((c) => (
          <motion.button
            layout
            key={`${c.key}:${c.value ?? ""}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => (c.value ? update({ [c.key]: getList(c.key).filter((x) => x !== c.value) }) : update({ [c.key]: null }))}
            className="group inline-flex h-6 items-center gap-1 rounded-none border border-line-strong bg-surface pl-2 pr-1 text-[12px] text-ink"
          >
            {c.label}
            <X size={11} className="text-ink-3 group-hover:text-ink" />
          </motion.button>
        ))}
      </AnimatePresence>
      <button
        onClick={() => update({ type: null, capability: null, modality: null, lab: null, provider: null, q: null, maxPrice: null, minContext: null, free: null, openWeights: null })}
        className="ml-1 text-[12px] text-copper hover:underline"
        data-testid="clear-filters"
      >
        Clear all
      </button>
    </div>
  );
}

export function ModelResults({ items, total, page, pageCount, sort }: { items: ModelCard[]; total: number; page: number; pageCount: number; sort: string }) {
  const { update, pending } = useQueryState();
  const [view, setView] = useState<"table" | "grid">("table");
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "grid" || v === "table") setView(v);
    } catch {}
  }, []);
  const setV = (v: "table" | "grid") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  return (
    <div className={cn("transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-ink-2" data-testid="result-count">
          <span className="num text-ink">{total.toLocaleString("en-US")}</span> {total === 1 ? "model" : "models"}
          {pending && <span className="ml-2 text-ink-3">updating…</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-8 items-center gap-1.5 rounded-none border border-line bg-surface px-2 text-[12.5px] text-ink-2">
            <ArrowDownUp size={13} />
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(e) => update({ sort: e.target.value === "score" ? null : e.target.value })} className="bg-transparent text-ink outline-none" data-testid="sort-select">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex h-8 rounded-none border border-line bg-surface p-0.5">
            {(["table", "grid"] as const).map((v) => (
              <button key={v} onClick={() => setV(v)} className={cn("flex w-7 items-center justify-center rounded-none", view === v ? "bg-surface-3 text-ink" : "text-ink-3")} aria-label={`${v} view`} aria-pressed={view === v}>
                {v === "table" ? <Rows3 size={14} /> : <LayoutGrid size={14} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-none border border-line bg-surface">
          <EmptyState
            title="No models match these filters"
            body="Loosen a constraint — price ceilings and capability combinations narrow results fastest."
            action={
              <button onClick={() => update({ type: null, capability: null, modality: null, lab: null, provider: null, q: null, maxPrice: null, minContext: null, free: null, openWeights: null })} className="rounded-none border border-line-strong px-3 py-1.5 text-[13px] hover:bg-surface-2">
                Reset filters
              </button>
            }
          />
        </div>
      ) : view === "table" ? (
        <ModelTable items={items} />
      ) : (
        <ModelGrid items={items} />
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px]">
          <button disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, { resetPage: false })} className="flex h-8 items-center gap-1 rounded-none border border-line bg-surface px-3 text-ink disabled:opacity-40" data-testid="prev-page">
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="num text-ink-3">
            Page {page} of {pageCount}
          </span>
          <button disabled={page >= pageCount} onClick={() => update({ page: String(page + 1) }, { resetPage: false })} className="flex h-8 items-center gap-1 rounded-none border border-line bg-surface px-3 text-ink disabled:opacity-40" data-testid="next-page">
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function ModelTable({ items }: { items: ModelCard[] }) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-surface">
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_60px_150px_62px_30px] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3 xl:grid">
        <span>Model</span>
        <span>Price in / out</span>
        <span>Context</span>
        <span>Modalities</span>
        <span className="text-right">Atlas</span>
        <span />
      </div>
      <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.018 } } }}>
        {items.map((m) => (
          <motion.li key={m.slug} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.25 }} className="border-b border-line last:border-0">
            <Link href={`/models/${m.slug}`} className="group grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 xl:grid-cols-[minmax(0,1fr)_120px_60px_150px_62px_30px]" data-testid="model-row">
              <span className="flex min-w-0 items-center gap-3">
                <LabMark slug={m.lab.slug} name={m.lab.name} size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-2">{m.name}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-ink-3">
                    <TypeTag type={m.type} />
                    <span className="truncate">
                      {m.lab.name} · {m.providerCount} provider{m.providerCount === 1 ? "" : "s"} · {fmtMonth(m.releasedAt)}
                      {m.gridRef && <span className="num text-copper"> · {m.gridRef}</span>}
                    </span>
                  </span>
                </span>
              </span>
              <span className="hidden xl:block">
                <PriceCell {...m.pricing} />
              </span>
              <span className="num hidden text-[12.5px] text-ink xl:block">{fmtTokens(m.contextLength)}</span>
              <span className="hidden flex-col gap-1 xl:flex">
                <ModalityStrip input={m.inputModalities} output={m.outputModalities} />
                <CapabilityIcons caps={m.capabilities} max={5} />
              </span>
              <span className="flex items-center justify-end gap-3 xl:contents">
                <span className="flex flex-col items-end xl:hidden">
                  <PriceCell {...m.pricing} />
                  <span className="num text-[11px] text-ink-3">{fmtTokens(m.contextLength)} ctx</span>
                </span>
                <span className="flex justify-end">
                  <ScoreDial score={m.score?.overall} confidence={m.score?.confidence} size={36} />
                </span>
                <span className="hidden justify-end sm:flex">
                  <CompareButton slug={m.slug} name={m.name} lab={m.lab.slug} />
                </span>
              </span>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

function ModelGrid({ items }: { items: ModelCard[] }) {
  return (
    <motion.div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.025 } } }}>
      {items.map((m) => (
        <motion.div key={m.slug} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
          <Link href={`/models/${m.slug}`} className="group flex h-full flex-col rounded-none border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]" data-testid="model-card">
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <LabMark slug={m.lab.slug} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-ink">{m.name}</span>
                  <span className="block truncate text-[12px] text-ink-3">{m.lab.name}</span>
                </span>
              </span>
              <ScoreDial score={m.score?.overall} confidence={m.score?.confidence} size={38} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-[11px] text-ink-3">
              <div>
                <div>In / out</div>
                <div className="mt-0.5">
                  <PriceCell {...m.pricing} />
                </div>
              </div>
              <div>
                <div>Context</div>
                <div className="num mt-0.5 text-[12.5px] text-ink">{fmtTokens(m.contextLength)}</div>
              </div>
              <div>
                <div>Providers</div>
                <div className="num mt-0.5 text-[12.5px] text-ink">{m.providerCount}</div>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between pt-3">
              <CapabilityIcons caps={m.capabilities} max={5} />
              <CompareButton slug={m.slug} name={m.name} lab={m.lab.slug} />
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
