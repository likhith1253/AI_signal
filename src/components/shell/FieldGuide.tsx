"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HelpCircle, X } from "lucide-react";
import { Kbd } from "./CommandPalette";

/**
 * Field guide: a plain-language legend for first-time visitors. Opens from the
 * "?" button in the top bar or the ? key. The map vocabulary (stations, ridge,
 * grid references, spot heights) is explained once, here, in ordinary words.
 */
const GuideCtx = createContext<{ open: () => void }>({ open: () => {} });
export const useFieldGuide = () => useContext(GuideCtx);

const SYMBOLS: { glyph: React.ReactNode; term: string; meaning: string }[] = [
  {
    glyph: (
      <svg width="16" height="14" aria-hidden>
        <path d="M8 1 L15 13 H1Z" fill="var(--ink-3)" />
      </svg>
    ),
    term: "Station",
    meaning: "One AI model, placed by its price (left → right) and its intelligence index (bottom → top).",
  },
  {
    glyph: (
      <svg width="30" height="8" aria-hidden>
        <path d="M0 4 H30" stroke="var(--copper)" strokeWidth="2" strokeDasharray="7 4" />
      </svg>
    ),
    term: "Frontier ridge",
    meaning: "The best models for their price. Nothing else is both cheaper and smarter.",
  },
  {
    glyph: (
      <svg width="30" height="10" aria-hidden>
        <path d="M0 7 Q8 1 15 5 T30 3" stroke="var(--contour)" fill="none" strokeWidth="1.3" />
      </svg>
    ),
    term: "Contours",
    meaning: "Where models crowd together. Tight rings mean many similar options.",
  },
  {
    glyph: <span className="num text-[12px] text-copper">G3·90</span>,
    term: "Grid reference",
    meaning: "A model's fixed square on the map: column = price band, row = capability band.",
  },
  {
    glyph: (
      <span className="num flex items-center gap-1 text-[12px] text-ink">
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
          <path d="M5 1 L9.3 9 H0.7 Z" fill="var(--copper)" />
        </svg>
        78
      </span>
    ),
    term: "Atlas score",
    meaning: "A 0–100 composite of benchmarks, price, context, providers and features. The thin bar shows how much of it rests on real data.",
  },
  {
    glyph: <span className="num text-[12px] text-ink-3">uns.</span>,
    term: "Unsurveyed",
    meaning: "Not enough published benchmarks to score fairly. Missing data is shown, never guessed.",
  },
];

const STEPS = [
  { href: "/models", title: "Browse every model", body: "Filter by capability, price and context; the URL keeps your filters." },
  { href: "/discover", title: "Pick by job", body: "Choose a workload (coding, agents, vision…) and get explained picks." },
  { href: "/compare", title: "Compare a shortlist", body: "Add up to four models with + and see differences side by side." },
  { href: "/rankings", title: "Read the rankings", body: "Each board says whether it's a benchmark, a spec or our composite." },
];

export function FieldGuideProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "?" && !(e.target as HTMLElement)?.closest("input,textarea,[contenteditable]")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <GuideCtx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto px-4 py-[6vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_40%,transparent)]" onClick={() => setOpen(false)} />
            <motion.div
              role="dialog"
              aria-label="Field guide"
              data-testid="field-guide"
              className="ticked relative w-full max-w-[760px] border border-ink bg-bg shadow-[var(--shadow)]"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              <div className="flex items-center justify-between border-b border-ink px-5 py-3">
                <div>
                  <div className="letter text-[11px] text-ink-3">How to read this atlas</div>
                  <div className="font-display text-[26px] leading-none text-ink">Field guide</div>
                </div>
                <button onClick={() => setOpen(false)} className="p-1 text-ink-2 hover:text-ink" aria-label="Close field guide">
                  <X size={18} />
                </button>
              </div>
              <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <div>
                  <div className="water mb-2 text-[14px] text-copper">The legend</div>
                  <dl className="flex flex-col gap-3">
                    {SYMBOLS.map((s) => (
                      <div key={s.term} className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-3">
                        <dt className="flex h-5 items-center justify-center">{s.glyph}</dt>
                        <dd className="text-[13px] leading-snug text-ink-2">
                          <span className="font-semibold text-ink">{s.term}.</span> {s.meaning}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <div className="water mb-2 text-[14px] text-copper">Where to start</div>
                  <ol className="flex flex-col border-t border-line-strong">
                    {STEPS.map((s, i) => (
                      <li key={s.href} className="border-b border-line-strong">
                        <Link href={s.href} onClick={() => setOpen(false)} className="group grid grid-cols-[26px_minmax(0,1fr)] gap-2 py-2.5 hover:bg-surface">
                          <span className="num pt-[2px] text-[11px] text-copper">{String(i + 1).padStart(2, "0")}</span>
                          <span>
                            <span className="letter block text-[13px] font-semibold text-ink group-hover:text-copper">{s.title}</span>
                            <span className="block text-[12.5px] text-ink-3">{s.body}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 text-[12.5px] text-ink-2">
                    <div className="letter mb-1.5 text-[10.5px] text-ink-3">Shortcuts</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      <span className="flex items-center gap-1">
                        <Kbd>Ctrl</Kbd>
                        <Kbd>K</Kbd> search
                      </span>
                      <span className="flex items-center gap-1">
                        <Kbd>/</Kbd> search
                      </span>
                      <span className="flex items-center gap-1">
                        <Kbd>?</Kbd> this guide
                      </span>
                      <span className="flex items-center gap-1">
                        <Kbd>Esc</Kbd> close
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="water border-t border-line px-5 py-2.5 text-[12px] text-ink-3">
                All data is real and sourced. Blank or &ldquo;—&rdquo; means not published; it is never treated as zero.{" "}
                <Link href="/methodology" onClick={() => setOpen(false)} className="not-italic text-copper hover:underline">
                  Full methodology →
                </Link>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GuideCtx.Provider>
  );
}

export function FieldGuideButton() {
  const { open } = useFieldGuide();
  return (
    <button
      onClick={open}
      className="letter flex h-8 items-center gap-1.5 border border-line-strong bg-surface px-2.5 text-[12px] font-semibold text-ink-2 hover:border-ink hover:text-ink"
      aria-label="Open the field guide"
      data-testid="guide-button"
    >
      <HelpCircle size={14} />
      <span className="hidden md:inline">Guide</span>
    </button>
  );
}

const WELCOME_KEY = "oneatlas.welcome.dismissed";

/** One-time orientation card on the overview sheet. */
export function WelcomeCard() {
  const { open } = useFieldGuide();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem(WELCOME_KEY));
    } catch {
      setShow(true);
    }
  }, []);
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch {}
  };
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="ticked mt-4 flex flex-col gap-3 border border-copper bg-copper-soft/50 px-4 py-3 sm:flex-row sm:items-center"
          data-testid="welcome-card"
        >
          <div className="min-w-0 flex-1">
            <div className="letter text-[12px] font-semibold text-copper">New here? Three things to know</div>
            <ol className="mt-1 grid gap-x-6 gap-y-0.5 text-[13px] text-ink-2 md:grid-cols-3">
              <li>
                <span className="num text-copper">1</span> Each ▲ on the map is a model: further right is pricier, higher is smarter.
              </li>
              <li>
                <span className="num text-copper">2</span> The red dashed ridge marks the best models for the money.
              </li>
              <li>
                <span className="num text-copper">3</span> Hover any point, or press <span className="num">Ctrl K</span> to find a model by name.
              </li>
            </ol>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={open} className="letter h-8 border border-ink bg-ink px-3 text-[12px] font-semibold text-bg hover:opacity-90">
              Open field guide
            </button>
            <button onClick={dismiss} className="letter h-8 border border-line-strong px-3 text-[12px] font-semibold text-ink-2 hover:text-ink" data-testid="welcome-dismiss">
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
