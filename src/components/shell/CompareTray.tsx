"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { compareStore, MAX_COMPARE, useCompare } from "@/lib/compare-store";
import { LabMark } from "../identity/LabMark";

/** Floating tray that keeps the comparison selection visible across pages. */
export function CompareTray() {
  const items = useCompare();
  const pathname = usePathname();
  const show = items.length > 0 && !pathname.startsWith("/compare");
  const href = `/compare?models=${items.map((i) => i.slug).join(",")}`;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-[760px] items-center gap-3 rounded-none border border-line-strong bg-surface p-2 pl-3 shadow-[var(--shadow)]"
          data-testid="compare-tray"
        >
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3 sm:block">
            Compare <span className="num">{items.length}/{MAX_COMPARE}</span>
          </span>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            <AnimatePresence initial={false}>
              {items.map((i) => (
                <motion.span
                  key={i.slug}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex shrink-0 items-center gap-1.5 rounded-none border border-line bg-surface-2 py-1 pl-1 pr-1.5 text-[12.5px] text-ink"
                >
                  <LabMark slug={i.lab} size={18} />
                  <span className="max-w-[140px] truncate">{i.name}</span>
                  <button onClick={() => compareStore.remove(i.slug)} className="text-ink-3 hover:text-ink" aria-label={`Remove ${i.name} from comparison`}>
                    <X size={12} />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
          <button onClick={() => compareStore.clear()} className="hidden text-[12px] text-ink-3 hover:text-ink sm:block">
            Clear
          </button>
          <Link href={href} className="flex h-8 shrink-0 items-center gap-1.5 rounded-none bg-accent px-3 text-[13px] font-medium text-accent-ink hover:opacity-90">
            Compare <ArrowRight size={14} />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
