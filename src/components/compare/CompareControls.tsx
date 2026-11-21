"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Search, X } from "lucide-react";
import { compareStore, MAX_COMPARE, useCompare } from "@/lib/compare-store";
import { LabMark } from "../identity/LabMark";

/** Keeps URL (?models=) and the persisted compare selection in sync, and adds models via search. */
export function CompareSync({ resolved }: { resolved: { slug: string; name: string; lab: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const store = useCompare();
  const urlModels = (sp.get("models") ?? "").split(",").filter(Boolean);
  const first = useRef(true);

  useEffect(() => {
    if (!first.current) return;
    first.current = false;
    if (urlModels.length) compareStore.set(resolved);
    else if (compareStore.get().length) router.replace(`/compare?models=${compareStore.get().map((i) => i.slug).join(",")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when the store changes elsewhere (tray, remove buttons), reflect it in the URL.
  // Skip the mount commit: the store is still empty then and would wipe a shared link.
  const synced = useRef(false);
  useEffect(() => {
    if (!synced.current) {
      synced.current = true;
      return;
    }
    const next = store.map((i) => i.slug).join(",");
    if (next !== urlModels.join(",")) router.replace(next ? `/compare?models=${next}` : "/compare", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);
  return null;
}

interface Hit {
  slug: string;
  name: string;
  lab: { name: string; slug: string };
}

export function AddModel({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const store = useCompare();
  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`, { signal: ctrl.signal });
        const j = await r.json();
        setHits(j.data?.models ?? []);
      } catch {}
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);
  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-none border border-dashed border-line-strong text-[13px] text-ink-2 transition-colors hover:border-ink-3 hover:bg-surface disabled:opacity-40"
        data-testid="compare-add"
      >
        <Plus size={18} />
        {disabled ? `Maximum ${MAX_COMPARE} models` : "Add a model"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute left-0 right-0 top-2 z-30 min-w-[260px] rounded-none border border-line-strong bg-surface shadow-[var(--shadow)]">
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search size={14} className="text-ink-3" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models…" className="h-10 flex-1 bg-transparent text-[13.5px] outline-none" data-testid="compare-search" />
              <button onClick={() => setOpen(false)} className="text-ink-3" aria-label="Close">
                <X size={14} />
              </button>
            </div>
            <ul className="max-h-[280px] overflow-y-auto p-1">
              {hits.map((h) => {
                const already = store.some((s) => s.slug === h.slug);
                return (
                  <li key={h.slug}>
                    <button
                      disabled={already}
                      onClick={() => {
                        compareStore.toggle({ slug: h.slug, name: h.name, lab: h.lab.slug });
                        setOpen(false);
                        setQ("");
                      }}
                      className="flex w-full items-center gap-2 rounded-none px-2 py-1.5 text-left text-[13px] hover:bg-surface-2 disabled:opacity-40"
                    >
                      <LabMark slug={h.lab.slug} size={20} />
                      <span className="flex-1 truncate text-ink">{h.name}</span>
                      <span className="text-[11px] text-ink-3">{already ? "added" : h.lab.name}</span>
                    </button>
                  </li>
                );
              })}
              {q && !hits.length && <li className="px-3 py-4 text-center text-[12.5px] text-ink-3">No matches</li>}
              {!q && <li className="px-3 py-4 text-center text-[12.5px] text-ink-3">Type a model name</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RemoveModel({ slug, name }: { slug: string; name: string }) {
  return (
    <button onClick={() => compareStore.remove(slug)} className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`Remove ${name}`} data-testid="compare-remove">
      <X size={14} />
    </button>
  );
}

export function DiffToggle() {
  const router = useRouter();
  const sp = useSearchParams();
  const fromUrl = sp.get("diff") === "1";
  // optimistic: the checkbox flips immediately, the URL catches up
  const [on, setOn] = useState(fromUrl);
  useEffect(() => setOn(fromUrl), [fromUrl]);
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked);
          const next = new URLSearchParams(sp.toString());
          if (e.target.checked) next.set("diff", "1");
          else next.delete("diff");
          router.replace(`/compare?${next.toString()}`, { scroll: false });
        }}
        className="accent-[var(--accent)]"
        data-testid="diff-toggle"
      />
      Only show differences
    </label>
  );
}
