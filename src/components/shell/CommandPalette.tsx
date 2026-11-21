"use client";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ArrowRight, Boxes, Building2, Clock, CornerDownLeft, Search, Server, X } from "lucide-react";
import { ALL_NAV } from "./nav";
import { LabMark } from "../identity/LabMark";

interface Results {
  models: { slug: string; name: string; externalId: string; type: string; lab: { name: string; slug: string }; providerCount: number; score: { overall: number | null } | null }[];
  labs: { slug: string; name: string; modelCount: number }[];
  providers: { slug: string; name: string; offeringCount: number }[];
}

const HISTORY_KEY = "oneatlas.search-history.v1";
interface HistoryItem {
  href: string;
  label: string;
  kind: "model" | "lab" | "provider" | "page";
}

const PaletteCtx = createContext<{ open: () => void }>({ open: () => {} });
export const usePalette = () => useContext(PaletteCtx);

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !open && !(e.target as HTMLElement)?.closest("input,textarea,[contenteditable]")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <PaletteCtx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <AnimatePresence>{open && <Palette onClose={() => setOpen(false)} />}</AnimatePresence>
    </PaletteCtx.Provider>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const reqId = useRef(0);

  useEffect(() => setHistory(loadHistory()), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setRes(null);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=6`);
        if (!r.ok) throw new Error(String(r.status));
        const json = (await r.json()) as { data: Results };
        if (id === reqId.current) {
          setRes(json.data);
          setError(false);
        }
      } catch {
        if (id === reqId.current) setError(true);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [q]);

  const go = useCallback(
    (item: HistoryItem) => {
      const next = [item, ...loadHistory().filter((h) => h.href !== item.href)].slice(0, 6);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
      onClose();
      router.push(item.href);
    },
    [onClose, router],
  );

  const pages = ALL_NAV.filter((n) => !q || n.label.toLowerCase().includes(q.toLowerCase()));
  const empty = q.trim() && res && !res.models.length && !res.labs.length && !res.providers.length && !pages.length;

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_28%,transparent)] backdrop-blur-[2px]" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-label="Search OneAtlas"
        className="relative w-full max-w-[640px] overflow-hidden rounded-none border border-line-strong bg-surface shadow-[var(--shadow)]"
        initial={{ y: -12, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -8, scale: 0.98, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
      >
        <Command shouldFilter={false} loop label="Search">
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search size={16} className="text-ink-3" />
            <Command.Input
              autoFocus
              value={q}
              onValueChange={setQ}
              placeholder="Search models, labs, providers…"
              className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
              data-testid="search-input"
            />
            {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line-strong border-t-accent" aria-label="Loading" />}
            <button onClick={onClose} className="rounded p-1 text-ink-3 hover:text-ink" aria-label="Close search">
              <X size={15} />
            </button>
          </div>
          <Command.List className="scrollbar-thin max-h-[min(60vh,460px)] overflow-y-auto p-2">
            {error && <div className="px-3 py-6 text-center text-sm text-negative">Search is unavailable right now.</div>}
            {empty && (
              <div className="px-3 py-10 text-center">
                <div className="font-display text-lg text-ink">Nothing matches “{q}”</div>
                <p className="mt-1 text-sm text-ink-3">Try a model family like “claude”, a lab like “mistral”, or a provider like “groq”.</p>
              </div>
            )}
            {!q.trim() && history.length > 0 && (
              <Group heading="Recent">
                {history.map((h) => (
                  <Item key={h.href} value={`h-${h.href}`} onSelect={() => go(h)} icon={<Clock size={14} />} label={h.label} meta={h.kind} />
                ))}
              </Group>
            )}
            {res && res.models.length > 0 && (
              <Group heading="Models">
                {res.models.map((m) => (
                  <Item
                    key={m.slug}
                    value={`m-${m.slug}`}
                    onSelect={() => go({ href: `/models/${m.slug}`, label: m.name, kind: "model" })}
                    icon={<LabMark slug={m.lab.slug} size={22} />}
                    label={m.name}
                    sub={m.externalId}
                    meta={m.score?.overall != null ? `Atlas ${m.score.overall.toFixed(0)}` : `${m.providerCount} prov.`}
                  />
                ))}
                <Item value="all-models" onSelect={() => go({ href: `/models?q=${encodeURIComponent(q)}`, label: `“${q}” in models`, kind: "page" })} icon={<Boxes size={14} />} label={`See all models matching “${q}”`} meta="" />
              </Group>
            )}
            {res && res.labs.length > 0 && (
              <Group heading="Labs">
                {res.labs.map((l) => (
                  <Item key={l.slug} value={`l-${l.slug}`} onSelect={() => go({ href: `/labs/${l.slug}`, label: l.name, kind: "lab" })} icon={<Building2 size={14} />} label={l.name} meta={`${l.modelCount} models`} />
                ))}
              </Group>
            )}
            {res && res.providers.length > 0 && (
              <Group heading="Providers">
                {res.providers.map((p) => (
                  <Item key={p.slug} value={`p-${p.slug}`} onSelect={() => go({ href: `/providers/${p.slug}`, label: p.name, kind: "provider" })} icon={<Server size={14} />} label={p.name} meta={`${p.offeringCount} offerings`} />
                ))}
              </Group>
            )}
            {pages.length > 0 && (
              <Group heading="Go to">
                {pages.slice(0, q ? 4 : 11).map((n) => (
                  <Item key={n.href} value={`n-${n.href}`} onSelect={() => go({ href: n.href, label: n.label, kind: "page" })} icon={<n.icon size={14} />} label={n.label} meta="" />
                ))}
              </Group>
            )}
          </Command.List>
          <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-4 py-2 text-[11px] text-ink-3">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="flex items-center gap-1"><Kbd><CornerDownLeft size={10} /></Kbd> open</span>
            <span className="flex items-center gap-1"><Kbd>esc</Kbd> close</span>
          </div>
        </Command>
      </motion.div>
    </motion.div>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group heading={heading} className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3">
      {children}
    </Command.Group>
  );
}

function Item({ value, onSelect, icon, label, sub, meta }: { value: string; onSelect: () => void; icon: React.ReactNode; label: string; sub?: string; meta: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-3 rounded-none px-2 py-2 text-sm text-ink-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink"
    >
      <span className="flex w-[22px] justify-center text-ink-3">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ink">{label}</span>
        {sub && <span className="num block truncate text-[11px] text-ink-3">{sub}</span>}
      </span>
      <span className="num text-[11px] text-ink-3">{meta}</span>
      <ArrowRight size={13} className="text-ink-3 opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-none border border-line-strong bg-surface px-1 text-[10px] text-ink-2">{children}</kbd>;
}
