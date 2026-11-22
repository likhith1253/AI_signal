import { AudioLines, Brain, Braces, Eye, FileText, Globe, ImagePlus, Layers, Unlock, Video, Wrench, Zap } from "lucide-react";
import { cn, fmtPrice, fmtTokens, TYPE_LABELS } from "@/lib/format";
import { Tag } from "../ui/primitives";

const CAP_ICONS: Record<string, { icon: typeof Brain; label: string }> = {
  tools: { icon: Wrench, label: "Tool calling" },
  "structured-outputs": { icon: Braces, label: "Structured outputs" },
  reasoning: { icon: Brain, label: "Reasoning" },
  vision: { icon: Eye, label: "Vision" },
  "audio-input": { icon: AudioLines, label: "Audio input" },
  "file-input": { icon: FileText, label: "File input" },
  "video-input": { icon: Video, label: "Video input" },
  "image-generation": { icon: ImagePlus, label: "Image generation" },
  "web-search": { icon: Globe, label: "Web search" },
  "prompt-caching": { icon: Zap, label: "Prompt caching" },
  "long-context": { icon: Layers, label: "Long context" },
  "open-weights": { icon: Unlock, label: "Open weights" },
};

const CAP_ORDER = ["reasoning", "tools", "structured-outputs", "vision", "file-input", "audio-input", "video-input", "image-generation", "web-search", "prompt-caching", "open-weights"];

export function CapabilityIcons({ caps, max = 6, className }: { caps: string[]; max?: number; className?: string }) {
  const sorted = CAP_ORDER.filter((c) => caps.includes(c));
  return (
    <span className={cn("flex items-center gap-1 text-ink-3", className)}>
      {sorted.slice(0, max).map((c) => {
        const I = CAP_ICONS[c].icon;
        return (
          <span key={c} title={CAP_ICONS[c].label} className="flex h-5 w-5 items-center justify-center rounded-none border border-line bg-surface-2">
            <I size={11} strokeWidth={1.8} aria-label={CAP_ICONS[c].label} />
          </span>
        );
      })}
      {sorted.length > max && <span className="num text-[10px]">+{sorted.length - max}</span>}
    </span>
  );
}

export function capabilityLabel(slug: string) {
  return CAP_ICONS[slug]?.label ?? slug;
}

export function CapabilityChip({ slug }: { slug: string }) {
  const c = CAP_ICONS[slug];
  if (!c) return <Tag>{slug}</Tag>;
  const I = c.icon;
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-none border border-line bg-surface px-2 text-[12px] text-ink-2">
      <I size={12} strokeWidth={1.8} className="text-accent" />
      {c.label}
    </span>
  );
}

const MODALITY_GLYPH: Record<string, string> = { text: "T", image: "I", audio: "A", video: "V", file: "F" };

/** Compact input→output modality strip, e.g. [T I F] → [T] */
export function ModalityStrip({ input, output }: { input: string[]; output: string[] }) {
  const cell = (m: string, on: boolean) => (
    <span
      key={m}
      title={m}
      className={cn("num flex h-[18px] w-[16px] items-center justify-center rounded-none text-[9.5px]", on ? "bg-ink text-bg" : "bg-surface-3 text-ink-3/60")}
    >
      {MODALITY_GLYPH[m]}
    </span>
  );
  const all = ["text", "image", "audio", "video", "file"];
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Input: ${input.join(", ")}; output: ${output.join(", ")}`}>
      <span className="flex gap-[2px]">{all.map((m) => cell(m, input.includes(m)))}</span>
      <span className="text-[10px] text-ink-3">→</span>
      <span className="flex gap-[2px]">{["text", "image", "audio"].map((m) => cell(m, output.includes(m)))}</span>
    </span>
  );
}

export function TypeTag({ type }: { type: string }) {
  return <Tag tone={type === "REASONING" ? "accent" : type === "ROUTER" ? "amber" : type === "MULTIMODAL" ? "copper" : "neutral"}>{TYPE_LABELS[type] ?? type}</Tag>;
}

/**
 * Atlas score as a surveyed spot height: a trig-point triangle and the value,
 * with a coverage rule underneath (how much of the score rests on data).
 * No score → an open triangle and a dash.
 */
export function ScoreDial({ score, confidence, size = 40 }: { score: number | null | undefined; confidence?: number | null; size?: number }) {
  const conf = confidence ?? 0;
  const big = size >= 48;
  const tri = big ? 11 : 8;
  return (
    <span
      className="inline-flex shrink-0 flex-col items-start justify-center"
      style={{ minWidth: big ? 64 : 44 }}
      title={score == null ? "No Atlas score: not enough benchmark data" : `Atlas score ${score.toFixed(1)} · ${Math.round(conf * 100)}% data coverage`}
    >
      <span className="flex items-center gap-1">
        <svg width={tri} height={tri} viewBox="0 0 10 10" aria-hidden>
          <path d="M5 1 L9.3 9 H0.7 Z" fill={score == null ? "none" : "var(--copper)"} stroke="var(--copper)" strokeWidth="1.2" />
          {score != null && <circle cx="5" cy="6.2" r="1.1" fill="var(--surface)" />}
        </svg>
        <span className={cn("num leading-none", score == null ? "text-ink-3" : "text-ink", big ? "text-[19px]" : "text-[13px]")}>{score == null ? "—" : score.toFixed(big ? 1 : 0)}</span>
      </span>
      {score != null && (
        <span className="mt-1 block h-[2px] w-full bg-line">
          <span className="block h-full bg-copper" style={{ width: `${conf * 100}%` }} />
        </span>
      )}
    </span>
  );
}

export function PriceCell({ input, output, isFree }: { input: number | null; output: number | null; isFree: boolean }) {
  if (isFree && !input && !output) return <Tag tone="positive">Free</Tag>;
  if (input == null && output == null) return <span className="text-[12px] text-ink-3" title="Price not published">Unknown</span>;
  return (
    <span className="num text-[12.5px] text-ink">
      {fmtPrice(input)} <span className="text-ink-3">/</span> {fmtPrice(output)}
    </span>
  );
}

export function ContextCell({ value }: { value: number | null }) {
  return <span className="num text-[12.5px] text-ink">{fmtTokens(value)}</span>;
}
