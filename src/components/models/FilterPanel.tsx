"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useQueryState } from "./useQueryState";
import { cn, TYPE_LABELS } from "@/lib/format";
import { capabilityLabel } from "./bits";

export interface Facet {
  value: string;
  label: string;
  count: number;
}
export interface Facets {
  labs: Facet[];
  providers: Facet[];
  types: Facet[];
  capabilities: Facet[];
  inputModalities: Facet[];
}

const PRICE_PRESETS = [
  { label: "Any", value: null },
  { label: "≤ $0.50", value: "0.5" },
  { label: "≤ $2", value: "2" },
  { label: "≤ $10", value: "10" },
];
const CONTEXT_PRESETS = [
  { label: "Any", value: null },
  { label: "32K+", value: "32000" },
  { label: "128K+", value: "128000" },
  { label: "200K+", value: "200000" },
  { label: "1M+", value: "1000000" },
];

function Section({ title, children, defaultOpen = true, count }: { title: string; children: React.ReactNode; defaultOpen?: boolean; count?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-3 last:border-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left text-[12px] font-medium uppercase tracking-[0.07em] text-ink-2" aria-expanded={open}>
        <span>
          {title}
          {!!count && <span className="num ml-1.5 rounded-none bg-copper px-1 text-[10px] text-[var(--surface)]">{count}</span>}
        </span>
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.15 }}>
          <ChevronDown size={14} className="text-ink-3" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="pt-2.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckList({ facets, selected, onToggle, searchable, limit = 8, format }: { facets: Facet[]; selected: string[]; onToggle: (v: string) => void; searchable?: boolean; limit?: number; format?: (f: Facet) => string }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const shown = useMemo(() => {
    const f = q ? facets.filter((x) => x.label.toLowerCase().includes(q.toLowerCase())) : facets;
    const sel = f.filter((x) => selected.includes(x.value));
    const rest = f.filter((x) => !selected.includes(x.value));
    return [...sel, ...rest].slice(0, all || q ? 200 : Math.max(limit, sel.length));
  }, [facets, q, all, selected, limit]);
  return (
    <div>
      {searchable && (
        <div className="mb-2 flex h-7 items-center gap-1.5 rounded-none border border-line bg-surface px-2">
          <Search size={12} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-ink-3" />
        </div>
      )}
      <ul className="flex flex-col">
        {shown.map((f) => {
          const on = selected.includes(f.value);
          return (
            <li key={f.value}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-[3px] text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
                <input type="checkbox" checked={on} onChange={() => onToggle(f.value)} className="peer sr-only" />
                <span className={cn("flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-none border transition-colors", on ? "border-accent bg-accent" : "border-line-strong bg-surface")}>
                  {on && (
                    <svg width="9" height="9" viewBox="0 0 10 10">
                      <path d="M2 5.2l2 2 4-4.4" stroke="var(--accent-ink)" strokeWidth="1.6" fill="none" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 truncate peer-focus-visible:underline">{format ? format(f) : f.label}</span>
                <span className="num text-[11px] text-ink-3">{f.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {!q && facets.length > limit && (
        <button onClick={() => setAll((a) => !a)} className="mt-1 px-1 text-[12px] text-accent hover:underline">
          {all ? "Show fewer" : `Show all ${facets.length}`}
        </button>
      )}
    </div>
  );
}

function Segments({ options, value, onChange }: { options: { label: string; value: string | null }[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = (o.value ?? null) === (value ?? null);
        return (
          <button key={o.label} onClick={() => onChange(o.value)} className={cn("num h-7 rounded-none border px-2 text-[12px] transition-colors", on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-line-strong")} aria-pressed={on}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterControls({ facets }: { facets: Facets }) {
  const { get, getList, update, toggleInList } = useQueryState();
  return (
    <div>
      <Section title="Type" count={getList("type").length}>
        <CheckList facets={facets.types} selected={getList("type")} onToggle={(v) => toggleInList("type", v)} format={(f) => TYPE_LABELS[f.value] ?? f.label} />
      </Section>
      <Section title="Capabilities" count={getList("capability").length}>
        <CheckList facets={facets.capabilities} selected={getList("capability")} onToggle={(v) => toggleInList("capability", v)} format={(f) => capabilityLabel(f.value)} limit={7} />
      </Section>
      <Section title="Input modality" count={getList("modality").length}>
        <CheckList facets={facets.inputModalities} selected={getList("modality")} onToggle={(v) => toggleInList("modality", v)} format={(f) => f.label[0].toUpperCase() + f.label.slice(1)} />
      </Section>
      <Section title="Blended price / 1M">
        <Segments options={PRICE_PRESETS} value={get("maxPrice")} onChange={(v) => update({ maxPrice: v, free: null })} />
        <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={get("free") === "true"} onChange={(e) => update({ free: e.target.checked ? "true" : null, maxPrice: null })} className="accent-[var(--accent)]" />
          Free models only
        </label>
      </Section>
      <Section title="Context window">
        <Segments options={CONTEXT_PRESETS} value={get("minContext")} onChange={(v) => update({ minContext: v })} />
      </Section>
      <Section title="Lab" count={getList("lab").length}>
        <CheckList facets={facets.labs} selected={getList("lab")} onToggle={(v) => toggleInList("lab", v)} searchable />
      </Section>
      <Section title="Provider" count={getList("provider").length} defaultOpen={false}>
        <CheckList facets={facets.providers} selected={getList("provider")} onToggle={(v) => toggleInList("provider", v)} searchable />
      </Section>
      <Section title="Licensing">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={get("openWeights") === "true"} onChange={(e) => update({ openWeights: e.target.checked ? "true" : null })} className="accent-[var(--accent)]" />
          Open weights only
        </label>
      </Section>
    </div>
  );
}

export function SearchBox() {
  const { get, update } = useQueryState();
  const [value, setValue] = useState(get("q") ?? "");
  const current = get("q") ?? "";
  // only push what the user typed; a URL change from elsewhere (e.g. "Clear all")
  // resets the box and cancels any pending debounce instead of re-applying stale input
  const dirty = useRef(false);
  useEffect(() => {
    dirty.current = false;
    setValue(current);
  }, [current]);
  useEffect(() => {
    if (!dirty.current || value === current) return;
    const t = setTimeout(() => {
      dirty.current = false;
      update({ q: value.trim() || null });
    }, 250);
    return () => clearTimeout(t);
  }, [value, current, update]);
  return (
    <div className="flex h-9 flex-1 items-center gap-2 rounded-none border border-line bg-surface px-3 focus-within:border-line-strong">
      <Search size={15} className="text-ink-3" />
      <input
        value={value}
        onChange={(e) => {
          dirty.current = true;
          setValue(e.target.value);
        }}
        placeholder="Filter by model, lab, family or provider…"
        className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-3"
        aria-label="Filter models"
        data-testid="models-search"
      />
      {value && (
        <button
          onClick={() => {
            dirty.current = true;
            setValue("");
          }}
          aria-label="Clear search" className="text-ink-3 hover:text-ink">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function MobileFilters({ facets, activeCount }: { facets: Facets; activeCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-1.5 rounded-none border border-line bg-surface px-3 text-[13px] text-ink lg:hidden" data-testid="mobile-filters">
        <SlidersHorizontal size={14} /> Filters
        {activeCount > 0 && <span className="num rounded-none bg-copper px-1 text-[10px] text-[var(--surface)]">{activeCount}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--ink)_30%,transparent)] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-y-auto rounded-none border-t border-line-strong bg-bg px-4 pb-6 lg:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <div className="sticky top-0 -mx-4 flex items-center justify-between border-b border-line bg-bg px-4 py-3">
                <span className="mx-auto h-1 w-10 rounded bg-line-strong" />
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-display text-lg">Filters</span>
                <button onClick={() => setOpen(false)} className="rounded-none bg-ink px-3 py-1.5 text-[13px] text-bg">
                  Show results
                </button>
              </div>
              <FilterControls facets={facets} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
