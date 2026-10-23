/**
 * AI Provider — Strategy Pattern
 *
 * Centralizes AI model configuration so that switching providers (Groq → OpenAI → Anthropic)
 * requires changing only this file, not every server action.
 *
 * Usage:
 *   import { getModel } from "@/lib/ai/ai-provider";
 *   const { text } = await generateText({ model: getModel(), prompt: "..." });
 */

import { groq } from "@ai-sdk/groq";
import { GROQ_MODEL } from "@/constants";

/**
 * Returns the configured AI language model instance.
 *
 * To switch providers, replace the implementation here:
 *   - Groq:    `groq("openai/gpt-oss-120b")`
 *   - OpenAI:  `openai("gpt-4o")`
 *   - Google:  `google("gemini-2.0-flash")`
 */
export function getModel() {
  return groq(GROQ_MODEL);
}

/**
 * Returns the model name string for logging/debugging.
 */
export function getModelName(): string {
  return GROQ_MODEL;
}
