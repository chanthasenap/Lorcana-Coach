import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResult,
  AIStructuredRequest,
  AIStructuredResult,
} from "../types";

// Deliberately dependency-free (plain fetch) rather than the openai SDK, to
// keep this a config-only swap alongside AnthropicProvider - both implement
// the same AIProvider interface. Not exercised in this app's own dev/test
// loop (Anthropic is the configured default), but real and ready to enable
// by setting OPENAI_API_KEY and pointing an AI_TASK_* var at "openai:<model>".

const OPENAI_API_BASE = "https://api.openai.com/v1";

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to your environment to use OpenAI-routed AI tasks.",
    );
  }
  return key;
}

async function chatCompletion(body: Record<string, unknown>) {
  const res = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ choices: { message: { content: string } }[] }>;
}

export const openaiProvider: AIProvider = {
  name: "openai",

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    const data = await chatCompletion({
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature,
      messages: [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        ...req.messages,
      ],
    });
    return { text: data.choices?.[0]?.message?.content ?? "" };
  },

  async completeStructured<T = unknown>(req: AIStructuredRequest): Promise<AIStructuredResult<T>> {
    const data = await chatCompletion({
      model: req.model,
      max_tokens: req.maxTokens ?? 1536,
      temperature: req.temperature,
      messages: [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        ...req.messages,
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: req.toolName, description: req.toolDescription, schema: req.schema, strict: true },
      },
    });
    const text = data.choices?.[0]?.message?.content ?? "{}";
    try {
      return { data: JSON.parse(text) as T };
    } catch (err) {
      throw new Error(
        `OpenAI structured output was not valid JSON for "${req.toolName}": ${(err as Error).message}`,
      );
    }
  },
};
