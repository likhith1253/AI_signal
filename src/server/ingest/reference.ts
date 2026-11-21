/**
 * Curated reference data (SourceKind.CURATED). Only well-established public
 * facts are recorded here; anything uncertain is left null rather than guessed.
 */

export interface LabRef {
  key: string; // lab key as derived from model ids (see labKeyFromId)
  name: string;
  website: string;
  headquarters: string | null;
  foundedYear: number | null;
  description: string;
  /** provider slugs that are this lab's own first-party API */
  firstPartyProviders?: string[];
}

export const LABS: LabRef[] = [
  { key: "openai", name: "OpenAI", website: "https://openai.com", headquarters: "San Francisco, US", foundedYear: 2015, firstPartyProviders: ["openai", "azure"], description: "Research and deployment company behind the GPT and o-series models, ChatGPT and the OpenAI API." },
  { key: "anthropic", name: "Anthropic", website: "https://www.anthropic.com", headquarters: "San Francisco, US", foundedYear: 2021, firstPartyProviders: ["anthropic"], description: "AI safety company that develops the Claude family of models." },
  { key: "google", name: "Google DeepMind", website: "https://deepmind.google", headquarters: "London, UK", foundedYear: 2010, firstPartyProviders: ["google-vertex", "google-ai-studio"], description: "Google's AI research lab, developer of the Gemini models and the open Gemma family." },
  { key: "meta", name: "Meta AI", website: "https://ai.meta.com", headquarters: "Menlo Park, US", foundedYear: 2013, description: "Meta's AI research organisation, publisher of the open-weights Llama model family." },
  { key: "mistralai", name: "Mistral AI", website: "https://mistral.ai", headquarters: "Paris, FR", foundedYear: 2023, firstPartyProviders: ["mistral"], description: "European lab shipping both open-weights and commercial models, including Mistral, Codestral and Pixtral." },
  { key: "deepseek", name: "DeepSeek", website: "https://www.deepseek.com", headquarters: "Hangzhou, CN", foundedYear: 2023, firstPartyProviders: ["deepseek"], description: "Research lab known for efficient open-weights mixture-of-experts and reasoning models." },
  { key: "x-ai", name: "xAI", website: "https://x.ai", headquarters: "San Francisco Bay Area, US", foundedYear: 2023, firstPartyProviders: ["xai"], description: "Developer of the Grok model family." },
  { key: "qwen", name: "Alibaba Qwen", website: "https://qwen.ai", headquarters: "Hangzhou, CN", foundedYear: null, firstPartyProviders: ["alibaba"], description: "Alibaba Cloud's Qwen team, publishing a broad family of open and hosted language, vision and coding models." },
  { key: "cohere", name: "Cohere", website: "https://cohere.com", headquarters: "Toronto, CA", foundedYear: 2019, firstPartyProviders: ["cohere"], description: "Enterprise-focused lab behind the Command models, embeddings and rerankers." },
  { key: "amazon", name: "Amazon", website: "https://aws.amazon.com/ai/generative-ai/nova/", headquarters: "Seattle, US", foundedYear: null, firstPartyProviders: ["amazon-bedrock"], description: "Amazon's Nova foundation models, served through Amazon Bedrock." },
  { key: "microsoft", name: "Microsoft", website: "https://www.microsoft.com/en-us/ai", headquarters: "Redmond, US", foundedYear: 1975, description: "Publishes research models such as the Phi family of small language models." },
  { key: "nvidia", name: "NVIDIA", website: "https://www.nvidia.com/en-us/ai/", headquarters: "Santa Clara, US", foundedYear: 1993, description: "GPU maker that also publishes open models such as the Nemotron family." },
  { key: "moonshotai", name: "Moonshot AI", website: "https://www.moonshot.ai", headquarters: "Beijing, CN", foundedYear: 2023, firstPartyProviders: ["moonshotai"], description: "Developer of the Kimi model family, known for long-context and agentic models." },
  { key: "z-ai", name: "Z.ai", website: "https://z.ai", headquarters: "Beijing, CN", foundedYear: 2019, firstPartyProviders: ["z-ai"], description: "Formerly Zhipu AI; develops the GLM family of language and vision models." },
  { key: "minimax", name: "MiniMax", website: "https://www.minimax.io", headquarters: "Shanghai, CN", foundedYear: 2021, firstPartyProviders: ["minimax"], description: "Builds large language, speech and video models including the MiniMax-M series." },
  { key: "perplexity", name: "Perplexity", website: "https://www.perplexity.ai", headquarters: "San Francisco, US", foundedYear: 2022, firstPartyProviders: ["perplexity"], description: "Answer engine company offering search-grounded Sonar models." },
  { key: "baidu", name: "Baidu", website: "https://www.baidu.com", headquarters: "Beijing, CN", foundedYear: 2000, description: "Chinese technology company developing the ERNIE model family." },
  { key: "tencent", name: "Tencent", website: "https://www.tencent.com", headquarters: "Shenzhen, CN", foundedYear: 1998, description: "Chinese technology company developing the Hunyuan model family." },
  { key: "bytedance", name: "ByteDance Seed", website: "https://seed.bytedance.com", headquarters: "Beijing, CN", foundedYear: null, description: "ByteDance's foundation-model research team." },
  { key: "xiaomi", name: "Xiaomi", website: "https://www.mi.com", headquarters: "Beijing, CN", foundedYear: 2010, description: "Consumer electronics company publishing the MiMo models." },
  { key: "stepfun", name: "StepFun", website: "https://www.stepfun.com", headquarters: "Shanghai, CN", foundedYear: 2023, description: "Chinese lab developing the Step family of multimodal models." },
  { key: "liquid", name: "Liquid AI", website: "https://www.liquid.ai", headquarters: "Cambridge, US", foundedYear: 2023, description: "MIT spin-out building efficient Liquid Foundation Models (LFM)." },
  { key: "ibm-granite", name: "IBM", website: "https://www.ibm.com/granite", headquarters: "Armonk, US", foundedYear: 1911, description: "Publishes the open Granite model family for enterprise use." },
  { key: "nousresearch", name: "Nous Research", website: "https://nousresearch.com", headquarters: null, foundedYear: null, description: "Open-source research collective known for the Hermes fine-tunes." },
  { key: "inclusionai", name: "inclusionAI", website: "https://huggingface.co/inclusionAI", headquarters: "Hangzhou, CN", foundedYear: null, description: "Ant Group's open model initiative, publishing the Ling and Ring families." },
  { key: "upstage", name: "Upstage", website: "https://www.upstage.ai", headquarters: "Seoul, KR", foundedYear: 2020, description: "Korean AI company developing the Solar models." },
  { key: "sakana", name: "Sakana AI", website: "https://sakana.ai", headquarters: "Tokyo, JP", foundedYear: 2023, description: "Tokyo research lab focused on nature-inspired and efficient AI methods." },
  { key: "thinkingmachines", name: "Thinking Machines Lab", website: "https://thinkingmachines.ai", headquarters: "San Francisco, US", foundedYear: 2025, description: "AI research and product company." },
  { key: "writer", name: "Writer", website: "https://writer.com", headquarters: "San Francisco, US", foundedYear: 2020, description: "Enterprise generative AI platform behind the Palmyra models." },
  { key: "openrouter", name: "OpenRouter", website: "https://openrouter.ai", headquarters: null, foundedYear: 2023, description: "Model router; its 'models' here are routing endpoints that select a model at request time." },
];

export interface BenchmarkRef {
  slug: string;
  name: string;
  category: string;
  description: string;
  scaleMin: number;
  scaleMax: number | null;
  scaleLabel: string;
  methodologyUrl: string;
  sourceSlug: string;
}

export const AA_INDICES: Record<string, { name: string; category: string; description: string }> = {
  intelligence_index: { name: "AA Intelligence Index", category: "intelligence", description: "Artificial Analysis composite of reasoning, knowledge, maths and coding evaluations." },
  coding_index: { name: "AA Coding Index", category: "coding", description: "Artificial Analysis composite of coding evaluations." },
  agentic_index: { name: "AA Agentic Index", category: "agentic", description: "Artificial Analysis composite of agentic / tool-use evaluations." },
};

export function aaBenchmarkRef(key: string): BenchmarkRef {
  const known = AA_INDICES[key];
  const pretty = key.replace(/_index$/, "").split("_").filter((w) => w !== "and").map((w) => w[0].toUpperCase() + w.slice(1)).join(" & ");
  return {
    slug: `aa-${key.replace(/_/g, "-")}`,
    name: known?.name ?? `AA ${pretty} Index`,
    category: known?.category ?? "domain",
    description: known?.description ?? `Artificial Analysis domain index for ${pretty.toLowerCase()} tasks.`,
    scaleMin: 0,
    scaleMax: 100,
    scaleLabel: "Index 0–100",
    methodologyUrl: "https://artificialanalysis.ai/methodology",
    sourceSlug: "artificial-analysis",
  };
}

const ARENA_NAMES: Record<string, string> = {
  "3d": "3D",
  codecategories: "Code (all categories)",
  gamedev: "Game development",
  uicomponent: "UI components",
  website: "Websites",
  dataviz: "Data visualisation",
  svg: "SVG",
  image: "Image",
};

export function arenaBenchmarkRef(arena: string, category: string): BenchmarkRef {
  const label = ARENA_NAMES[category] ?? category.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return {
    slug: `design-arena-${arena === "models" ? "" : `${arena}-`}${category}`.toLowerCase(),
    name: `Design Arena · ${label}`,
    category: "design",
    description: `Head-to-head human preference Elo on Design Arena's ${label.toLowerCase()} category.`,
    scaleMin: 0,
    scaleMax: null,
    scaleLabel: "Elo rating",
    methodologyUrl: "https://www.designarena.ai",
    sourceSlug: "design-arena",
  };
}

export const DATA_SOURCES = [
  {
    slug: "openrouter",
    name: "OpenRouter Models API",
    url: "https://openrouter.ai/api/v1/models",
    kind: "API" as const,
    description: "Public model catalogue, per-provider endpoints, pricing and provider directory.",
    termsNote: "Public, unauthenticated endpoints. Fetched with bounded concurrency.",
  },
  {
    slug: "artificial-analysis",
    name: "Artificial Analysis",
    url: "https://artificialanalysis.ai",
    kind: "API" as const,
    description: "Independent benchmark indices, as redistributed in the OpenRouter catalogue.",
    termsNote: "Scores attributed to Artificial Analysis; retrieved via OpenRouter's catalogue.",
  },
  {
    slug: "design-arena",
    name: "Design Arena",
    url: "https://www.designarena.ai",
    kind: "API" as const,
    description: "Crowd-sourced head-to-head Elo ratings for design/code generation, as redistributed by OpenRouter.",
    termsNote: "Ratings attributed to Design Arena; retrieved via OpenRouter's catalogue.",
  },
  {
    slug: "oneatlas-curated",
    name: "OneAtlas curated reference",
    url: "https://github.com/likhith1253/AI_signal/blob/main/src/server/ingest/reference.ts",
    kind: "CURATED" as const,
    description: "Hand-maintained lab metadata (headquarters, founding year, website).",
    termsNote: null,
  },
  {
    slug: "oneatlas-derived",
    name: "Atlas Engine (derived)",
    url: "https://github.com/likhith1253/AI_signal/blob/main/docs/SCORING.md",
    kind: "DERIVED" as const,
    description: "Scores, percentiles and aggregates computed by OneAtlas from the sources above.",
    termsNote: null,
  },
];
