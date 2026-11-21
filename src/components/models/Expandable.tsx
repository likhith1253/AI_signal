"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function Expandable({ label, children, defaultOpen = false }: { label: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-1 text-left text-[12.5px] text-ink-2 hover:text-ink" aria-expanded={open}>
        {label}
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      className="num inline-flex items-center gap-1.5 rounded-none border border-line bg-surface-2 px-2 py-0.5 text-[12px] text-ink-2 hover:text-ink"
      title="Copy model id"
    >
      {value}
      <span className="text-[10px] text-ink-3">{copied ? "copied" : "copy"}</span>
    </button>
  );
}
