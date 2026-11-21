"use client";
import { Check, Plus } from "lucide-react";
import { motion } from "motion/react";
import { compareStore, MAX_COMPARE, useCompare } from "@/lib/compare-store";
import { cn } from "@/lib/format";

export function CompareButton({ slug, name, lab, variant = "icon" }: { slug: string; name: string; lab: string; variant?: "icon" | "full" }) {
  const items = useCompare();
  const selected = items.some((i) => i.slug === slug);
  const full = !selected && items.length >= MAX_COMPARE;
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    compareStore.toggle({ slug, name, lab });
  };
  if (variant === "full")
    return (
      <button
        onClick={onClick}
        disabled={full}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-none border px-3 text-[13px] transition-colors disabled:opacity-50",
          selected ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface text-ink hover:bg-surface-2",
        )}
        data-testid="compare-toggle"
        aria-pressed={selected}
      >
        {selected ? <Check size={14} /> : <Plus size={14} />}
        {selected ? "In comparison" : full ? "Comparison full" : "Add to compare"}
      </button>
    );
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      disabled={full}
      title={selected ? "Remove from comparison" : full ? `Compare holds ${MAX_COMPARE} models` : "Add to comparison"}
      aria-label={selected ? `Remove ${name} from comparison` : `Add ${name} to comparison`}
      aria-pressed={selected}
      data-testid="compare-toggle"
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-none border transition-colors disabled:opacity-40",
        selected ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink",
      )}
    >
      {selected ? <Check size={13} /> : <Plus size={13} />}
    </motion.button>
  );
}
