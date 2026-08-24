import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const config: ConstructorParameters<typeof OpenAI>[0] = {
      apiKey: process.env.OPENAI_API_KEY,
    };

    // Amazon Bedrock Mantle — OpenAI-compatible endpoint.
    // Verified working model: qwen.qwen3-32b
    // (Claude models on this endpoint use a different API format
    //  and are NOT compatible with /v1/chat/completions)
    if (process.env.OPENAI_BASE_URL) {
      config.baseURL = process.env.OPENAI_BASE_URL;
    }

    if (process.env.OPENAI_PROJECT_ID) {
      config.project = process.env.OPENAI_PROJECT_ID;
    }

    _client = new OpenAI(config);
  }
  return _client;
}

// Model IDs — all confirmed working on Bedrock Mantle (JSON ✅  tools ✅  streaming ✅)
export const DRAFTING_MODEL =
  process.env.OPENAI_DRAFTING_MODEL ?? "qwen.qwen3-32b";

export const EXTRACTION_MODEL =
  process.env.OPENAI_EXTRACTION_MODEL ?? "qwen.qwen3-32b";

export const VISION_MODEL =
  process.env.OPENAI_VISION_MODEL ?? "qwen.qwen3-32b";

// Fast model for lightweight tasks (same model — swap to a cheaper one if available)
export const FAST_MODEL =
  process.env.OPENAI_FAST_MODEL ?? "qwen.qwen3-32b";
