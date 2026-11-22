/** Display formatting. Unknown is always shown as unknown - never as 0. */

export function fmtPrice(v: number | null | undefined, opts: { free?: boolean; variable?: boolean; unit?: string } = {}): string {
  if (opts.variable) return "Variable";
  if (v == null) return "—";
  if (v === 0) return "Free";
  const s = v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toFixed(4);
  return `$${s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "")}${opts.unit ?? ""}`;
}

export function fmtTokens(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}K`;
  return String(v);
}

export function fmtScore(v: number | null | undefined, digits = 1): string {
  return v == null ? "—" : v.toFixed(digits);
}

export function fmtPct(v: number | null | undefined, digits = 0): string {
  return v == null ? "—" : `${v.toFixed(digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function fmtMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d}d ago`;
  return fmtDate(iso);
}

export const TYPE_LABELS: Record<string, string> = {
  CHAT: "Chat",
  REASONING: "Reasoning",
  MULTIMODAL: "Multimodal",
  IMAGE_GENERATION: "Image gen",
  AUDIO: "Audio",
  VIDEO: "Video",
  EMBEDDING: "Embedding",
  ROUTER: "Router",
};

export const COMPONENT_LABELS: Record<string, string> = {
  INPUT: "Input",
  OUTPUT: "Output",
  CACHE_READ: "Cache read",
  CACHE_WRITE: "Cache write",
  REASONING: "Reasoning",
  IMAGE_INPUT: "Image input",
  AUDIO_INPUT: "Audio input",
  IMAGE_OUTPUT: "Image output",
  AUDIO_OUTPUT: "Audio output",
  WEB_SEARCH: "Web search",
  REQUEST: "Per request",
};

export const UNIT_LABELS: Record<string, string> = {
  PER_MILLION_TOKENS: "/ 1M tok",
  PER_IMAGE: "/ image",
  PER_SEARCH: "/ search",
  PER_REQUEST: "/ request",
  PER_MILLION_UNITS: "/ 1M units",
};

export function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}
