import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResult,
  AIStructuredRequest,
  AIStructuredResult,
} from "../types";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to your environment to use Anthropic-routed AI tasks.",
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export const anthropicProvider: AIProvider = {
  name: "anthropic",

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const res = await getClient().messages.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature,
      system: req.system,
      messages: req.messages,
    });
    return { text: extractText(res.content) };
  },

  async completeStructured<T = unknown>(req: AIStructuredRequest): Promise<AIStructuredResult<T>> {
    // Native structured outputs: Claude is constrained to emit JSON matching
    // the schema, rather than relying on prompt instructions + hoping.
    // https://platform.claude.com/docs/en/build-with-claude/structured-outputs
    const res = await getClient().messages.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 1536,
      temperature: req.temperature,
      system: req.system,
      messages: req.messages,
      output_config: {
        format: { type: "json_schema", schema: req.schema },
      },
    });
    const text = extractText(res.content);
    try {
      return { data: JSON.parse(text) as T };
    } catch (err) {
      throw new Error(
        `Anthropic structured output was not valid JSON for tool "${req.toolName}": ${(err as Error).message}\nRaw: ${text.slice(0, 500)}`,
      );
    }
  },
};
