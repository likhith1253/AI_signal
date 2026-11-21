"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GitCompareArrows, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { ALL_NAV, NAV } from "./nav";
import { Wordmark, LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { CommandPaletteProvider, Kbd, usePalette } from "./CommandPalette";
import { CompareTray } from "./CompareTray";
import { SurveyLoader } from "./SurveyLoader";
import { useCompare } from "@/lib/compare-store";

const COLLAPSE_KEY = "oneatlas.sidebar.collapsed";
const COLS = "ABCDEFGHJKLMNOPQ".split("");

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** The atlas index: sheet numbers on the left, dotted leaders, active sheet flagged in signal red. */
function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-4" aria-label="Primary">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className={`water mb-1 px-2 text-[12.5px] text-ink-3 transition-opacity ${collapsed ? "opacity-0" : "opacity-100"}`}>{g.group}</div>
          <ul className="flex flex-col">
            {g.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? `${item.sheet} · ${item.label}` : undefined}
                    aria-label={item.label}
                    className={`group relative flex h-8 items-center gap-2 px-2 transition-colors ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && <motion.span layoutId="nav-active" className="absolute inset-0 border-y border-ink bg-surface" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
                    <span className={`num relative w-6 shrink-0 text-[11px] ${active ? "text-copper" : "text-ink-3 group-hover:text-ink-2"}`}>{item.sheet}</span>
                    {collapsed ? (
                      <item.icon size={15} strokeWidth={1.6} className="relative -ml-1 shrink-0" />
                    ) : (
                      <>
                        <span className="letter relative truncate text-[13.5px] font-medium tracking-[0.08em]">{item.label}</span>
                        <span className="relative mb-[3px] h-px flex-1 self-end border-b border-dotted border-line-strong" />
                        {active && <span className="relative h-2 w-2 shrink-0 rotate-45 bg-copper" aria-hidden />}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { open } = usePalette();
  const compare = useCompare();
  const pathname = usePathname();
  const sheet = ALL_NAV.find((n) => isActive(pathname, n.href));
  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-bg">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <button onClick={onMenu} className="-ml-1 p-1.5 text-ink-2 hover:text-ink lg:hidden" aria-label="Open navigation" data-testid="mobile-menu">
          <Menu size={19} />
        </button>
        <Link href="/" className="lg:hidden" aria-label="OneAtlas home">
          <Wordmark compact />
        </Link>
        <span className="letter hidden text-[11.5px] text-ink-3 xl:inline">
          {sheet ? (
            <>
              Sheet <span className="num text-copper">{sheet.sheet}</span> / 11 · {sheet.label}
            </>
          ) : (
            "Sheet detail"
          )}
        </span>
        <button
          onClick={open}
          className="group ml-auto flex h-8 w-full max-w-[440px] items-center gap-2 border border-line-strong bg-surface px-3 text-left text-[13.5px] text-ink-3 transition-colors hover:border-ink"
          data-testid="search-trigger"
          aria-label="Search"
        >
          <Search size={14} />
          <span className="hidden flex-1 sm:inline">Find a model, lab or provider…</span>
          <span className="flex-1 sm:hidden">Search</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <Link
            href="/compare"
            className="letter relative hidden h-8 items-center gap-1.5 border border-line-strong bg-surface px-2.5 text-[12px] font-semibold text-ink-2 hover:border-ink hover:text-ink sm:flex"
            aria-label={`Compare (${compare.length} selected)`}
          >
            <GitCompareArrows size={14} />
            Compare
            <AnimatePresence>
              {compare.length > 0 && (
                <motion.span key={compare.length} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} className="num flex h-4 min-w-4 items-center justify-center bg-copper px-1 text-[10px] text-[var(--surface)]">
                  {compare.length}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          <ThemeToggle />
        </div>
      </div>
      {/* graticule: the column letters of the sheet, as printed along a map's neatline */}
      <div className="relative hidden h-[18px] border-t border-line-strong md:block" aria-hidden>
        <div className="absolute inset-0 flex">
          {COLS.map((c) => (
            <span key={c} className="num relative flex flex-1 items-center justify-center border-r border-line text-[9px] text-ink-3 last:border-0">
              {c}
              <span className="absolute bottom-0 left-1/4 h-1 w-px bg-line-strong" />
              <span className="absolute bottom-0 left-1/2 h-1.5 w-px bg-line-strong" />
              <span className="absolute bottom-0 left-3/4 h-1 w-px bg-line-strong" />
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);
  useEffect(() => setDrawer(false), [pathname]);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  return (
    <CommandPaletteProvider>
      <SurveyLoader />
      <div className="flex min-h-dvh">
        <motion.aside
          animate={{ width: collapsed ? 68 : 244 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-ink bg-bg lg:flex"
          data-testid="sidebar"
        >
          <div className="flex h-[74px] items-center border-b border-ink px-4">
            <Link href="/" aria-label="OneAtlas home" className="overflow-hidden">
              {collapsed ? <LogoMark size={28} /> : <Wordmark />}
            </Link>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
            <NavList collapsed={collapsed} />
          </div>
          <div className="border-t border-line-strong p-2">
            {!collapsed && (
              <div className="mb-2 px-2">
                <div className="letter text-[10px] text-ink-3">Scale</div>
                <div className="mt-1 flex h-[5px] border border-ink">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={`flex-1 ${i % 2 ? "bg-surface" : "bg-ink"}`} />
                  ))}
                </div>
                <div className="num mt-0.5 flex justify-between text-[9px] text-ink-3">
                  <span>0</span>
                  <span>250</span>
                  <span>500 models</span>
                </div>
              </div>
            )}
            <button onClick={toggle} className="letter flex h-8 w-full items-center gap-2.5 px-2 text-[11px] text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              <span className={collapsed ? "opacity-0" : ""}>Fold index</span>
            </button>
          </div>
        </motion.aside>

        <AnimatePresence>
          {drawer && (
            <>
              <motion.div className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--ink)_35%,transparent)] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
              <motion.aside
                className="fixed inset-y-0 left-0 z-50 flex w-[284px] flex-col border-r border-ink bg-bg lg:hidden"
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                data-testid="mobile-drawer"
              >
                <div className="flex h-16 items-center justify-between border-b border-ink px-4">
                  <Wordmark />
                  <button onClick={() => setDrawer(false)} className="p-1 text-ink-2" aria-label="Close navigation">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-4">
                  <NavList collapsed={false} onNavigate={() => setDrawer(false)} />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenu={() => setDrawer(true)} />
          <main className="relative min-w-0 flex-1">
            {/* route change: a survey line sweeps across the sheet, then the sheet settles in */}
            <motion.div key={`sweep-${pathname}`} className="pointer-events-none absolute left-0 top-0 z-30 h-[2px] w-full origin-left bg-copper" initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: 1, opacity: 0 }} transition={{ scaleX: { duration: 0.45, ease: [0.65, 0, 0.35, 1] }, opacity: { delay: 0.35, duration: 0.25 } }} />
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
              {children}
            </motion.div>
          </main>
          <footer className="border-t border-ink px-4 py-5 text-[12px] text-ink-3 md:px-8">
            <div className="mx-auto flex max-w-[1320px] flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-[640px]">
                <div className="letter text-[11px] font-semibold text-ink-2">Sources &amp; datum</div>
                <p className="mt-1 leading-relaxed">
                  Surveyed from the OpenRouter public catalogue, with indices by Artificial Analysis and Elo by Design Arena. Atlas scores are OneAtlas composites of published data, not independent measurements. Unknown values are left blank, never filled.
                </p>
              </div>
              <span className="letter flex gap-4 text-[11px] font-semibold">
                <Link href="/methodology" className="hover:text-copper">Methodology</Link>
                <Link href="/engine" className="hover:text-copper">Freshness</Link>
                <a href="https://github.com/likhith1253/AI_signal" className="hover:text-copper">Source</a>
              </span>
            </div>
          </footer>
        </div>
      </div>
      <CompareTray />
    </CommandPaletteProvider>
  );
}
