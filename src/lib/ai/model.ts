import type { LanguageModel } from "ai";

import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export type AiProvider = "google" | "openai" | "anthropic";

const PROVIDERS: AiProvider[] = ["google", "openai", "anthropic"];

function isProvider(value: string): value is AiProvider {
  return PROVIDERS.includes(value as AiProvider);
}

function defaultModelFor(provider: AiProvider): string {
  switch (provider) {
    case "google":
      return "gemini-2.5-flash";
    case "openai":
      return "gpt-4o";
    case "anthropic":
      return "claude-sonnet-4-20250514";
  }
}

/**
 * Resolve the extraction model from env so providers stay swappable.
 * Default: Google Gemini 2.5 Flash (vision + Japanese, low cost).
 *
 * AI_PROVIDER=google|openai|anthropic
 * AI_MODEL=<provider model id>
 */
export function getModel(): LanguageModel {
  const raw = process.env.AI_PROVIDER ?? "google";
  if (!isProvider(raw)) {
    throw new Error(
      `Unsupported AI_PROVIDER="${raw}". Use one of: ${PROVIDERS.join(", ")}`,
    );
  }

  const modelId = process.env.AI_MODEL ?? defaultModelFor(raw);

  switch (raw) {
    case "google":
      return google(modelId);
    case "openai":
      return openai(modelId);
    case "anthropic":
      return anthropic(modelId);
  }
}
