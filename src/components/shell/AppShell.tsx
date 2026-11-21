"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GitCompareArrows, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { NAV } from "./nav";
import { Wordmark, LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { CommandPaletteProvider, Kbd, usePalette } from "./CommandPalette";
import { CompareTray } from "./CompareTray";
import { useCompare } from "@/lib/compare-store";

const COLLAPSE_KEY = "oneatlas.sidebar.collapsed";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5" aria-label="Primary">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className={`mb-1.5 px-3 text-[10.5px] font-medium uppercase tracking-[0.09em] text-ink-3 transition-opacity ${collapsed ? "opacity-0" : "opacity-100"}`}>{g.group}</div>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex h-8 items-center gap-2.5 rounded-md px-3 text-[13.5px] transition-colors ${active ? "text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-md border border-line bg-surface shadow-[0_1px_0_var(--line)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                    {active && <motion.span layoutId="nav-tick" className="absolute -left-[13px] top-1.5 h-5 w-[3px] rounded-r bg-copper" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                    <item.icon size={15} strokeWidth={1.7} className={`relative shrink-0 ${active ? "text-accent" : ""}`} />
                    <span className={`relative truncate transition-opacity ${collapsed ? "opacity-0" : "opacity-100"}`}>{item.label}</span>
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
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-4 backdrop-blur-md md:px-6">
      <button onClick={onMenu} className="-ml-1 rounded-md p-1.5 text-ink-2 hover:text-ink lg:hidden" aria-label="Open navigation" data-testid="mobile-menu">
        <Menu size={19} />
      </button>
      <Link href="/" className="lg:hidden" aria-label="OneAtlas home">
        <Wordmark />
      </Link>
      <button
        onClick={open}
        className="group ml-auto flex h-8 w-full max-w-[420px] items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-[13px] text-ink-3 transition-colors hover:border-line-strong md:ml-0 lg:ml-0"
        data-testid="search-trigger"
        aria-label="Search"
      >
        <Search size={14} />
        <span className="hidden flex-1 sm:inline">Search 470+ models, labs, providers…</span>
        <span className="flex-1 sm:hidden">Search</span>
        <span className="hidden items-center gap-0.5 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <div className="flex items-center gap-2 md:ml-auto">
        <Link
          href="/compare"
          className="relative hidden h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink-2 hover:border-line-strong hover:text-ink sm:flex"
          aria-label={`Compare (${compare.length} selected)`}
        >
          <GitCompareArrows size={14} />
          Compare
          <AnimatePresence>
            {compare.length > 0 && (
              <motion.span key={compare.length} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} className="num flex h-4 min-w-4 items-center justify-center rounded-[3px] bg-copper px-1 text-[10px] text-[var(--surface)]">
                {compare.length}
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <ThemeToggle />
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
      <div className="flex min-h-dvh">
        <motion.aside
          animate={{ width: collapsed ? 64 : 232 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg lg:flex"
          data-testid="sidebar"
        >
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/" aria-label="OneAtlas home" className="overflow-hidden">
              {collapsed ? <LogoMark /> : <Wordmark />}
            </Link>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            <NavList collapsed={collapsed} />
          </div>
          <div className="border-t border-line p-3">
            <button onClick={toggle} className="flex h-8 w-full items-center gap-2.5 rounded-md px-3 text-[12.5px] text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              <span className={collapsed ? "opacity-0" : ""}>Collapse</span>
            </button>
          </div>
        </motion.aside>

        <AnimatePresence>
          {drawer && (
            <>
              <motion.div className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--ink)_30%,transparent)] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
              <motion.aside
                className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-line bg-bg lg:hidden"
                initial={{ x: -290 }}
                animate={{ x: 0 }}
                exit={{ x: -290 }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                data-testid="mobile-drawer"
              >
                <div className="flex h-14 items-center justify-between px-4">
                  <Wordmark />
                  <button onClick={() => setDrawer(false)} className="rounded p-1 text-ink-2" aria-label="Close navigation">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3">
                  <NavList collapsed={false} onNavigate={() => setDrawer(false)} />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenu={() => setDrawer(true)} />
          <main className="min-w-0 flex-1">{children}</main>
          <footer className="border-t border-line px-4 py-6 text-[12px] text-ink-3 md:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                OneAtlas — data from the OpenRouter public catalogue, Artificial Analysis and Design Arena. Scores are OneAtlas composites, not independent measurements.
              </span>
              <span className="flex gap-4">
                <Link href="/methodology" className="hover:text-ink">Methodology</Link>
                <Link href="/engine" className="hover:text-ink">Data freshness</Link>
                <a href="https://github.com/likhith1253/AI_signal" className="hover:text-ink">GitHub</a>
              </span>
            </div>
          </footer>
        </div>
      </div>
      <CompareTray />
    </CommandPaletteProvider>
  );
}
