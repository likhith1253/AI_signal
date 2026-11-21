"use client";
import { Search } from "lucide-react";
import { usePalette, Kbd } from "./CommandPalette";

export function HeroSearch() {
  const { open } = usePalette();
  return (
    <button
      onClick={open}
      className="group flex h-12 w-full max-w-[560px] items-center gap-3 rounded-lg border border-line-strong bg-surface px-4 text-left text-[14.5px] text-ink-3 shadow-[var(--shadow)] transition-colors hover:border-ink-3"
      data-testid="hero-search"
    >
      <Search size={17} className="text-ink-2" />
      <span className="flex-1">Try “claude”, “qwen coder”, “groq” or “deepseek”…</span>
      <span className="hidden items-center gap-0.5 sm:flex">
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
