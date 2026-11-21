/** Trimmed records with the exact shape returned by the live OpenRouter API (Nov 2026). */
export const orModel = {
  id: "mistralai/pixtral-large-2502",
  canonical_slug: "mistralai/pixtral-large-2502",
  hugging_face_id: null,
  name: "Mistral: Pixtral Large 2502",
  created: 1795135865,
  description: "Pixtral Large 2502 is the February 2025 version of [Pixtral Large 2411](https://openrouter.ai/mistralai/pixtral-large-2411). It accepts text and image input...",
  context_length: 128000,
  architecture: { modality: "text+image->text", input_modalities: ["text", "image"], output_modalities: ["text"], tokenizer: "Mistral", instruct_type: null },
  pricing: { prompt: "0.000002", completion: "0.000006" },
  top_provider: { context_length: 128000, max_completion_tokens: 102400, is_moderated: true },
  per_request_limits: null,
  supported_parameters: ["max_tokens", "stop", "temperature", "tools", "tool_choice", "response_format"],
  default_parameters: {},
  knowledge_cutoff: null,
  expiration_date: null,
  benchmarks: {
    artificial_analysis: { intelligence_index: 41.2, coding_index: null, agentic_index: 30.5, legal_index: 55.1 },
    design_arena: [
      { arena: "models", category: "website", elo: 1201, win_rate: 44.1, rank: 31 },
      { arena: "models", category: "website", elo: 1199, win_rate: 44.0, rank: 32 },
    ],
  },
};

export const orEndpoint = {
  name: "DeepInfra | meta-llama/llama-3.3-70b-instruct",
  model_id: "meta-llama/llama-3.3-70b-instruct",
  context_length: 131072,
  pricing: { prompt: "0.0000001", completion: "0.00000032", discount: 0 },
  provider_name: "DeepInfra",
  tag: "deepinfra/turbo",
  quantization: "fp8",
  max_completion_tokens: 16384,
  max_prompt_tokens: null,
  supported_parameters: ["max_tokens", "tools"],
  status: 0,
  uptime_last_1d: 99.64,
  supports_implicit_caching: false,
};
