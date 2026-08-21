import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export const DRAFTING_MODEL = "gpt-4o";
export const EXTRACTION_MODEL = "gpt-4o";
export const VISION_MODEL = "gpt-4o";
