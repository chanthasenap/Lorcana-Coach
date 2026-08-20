import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import type {
  AITask,
  AIProvider,
  AICompletionRequest,
  AICompletionResult,
  AIStructuredRequest,
  AIStructuredResult,
} from "./types";

export * from "./types";

const providers: Record<string, AIProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
};

const envKeyByTask: Record<AITask, string> = {
  scenario_generation: "AI_TASK_SCENARIO_GENERATION",
  game_analysis: "AI_TASK_GAME_ANALYSIS",
  coaching: "AI_TASK_COACHING",
  rules: "AI_TASK_RULES",
  pattern_detection: "AI_TASK_PATTERN_DETECTION",
  team_strategy: "AI_TASK_TEAM_STRATEGY",
};

const DEFAULT_ROUTE = "anthropic:claude-haiku-4-5";

/** Allows tests to inject a fake provider instead of hitting a real API. */
export function registerProviderForTesting(name: string, provider: AIProvider) {
  providers[name] = provider;
}

export function resolveRoute(task: AITask): { provider: AIProvider; model: string } {
  const envKey = envKeyByTask[task];
  const raw = process.env[envKey] || DEFAULT_ROUTE;
  const separatorIndex = raw.indexOf(":");
  if (separatorIndex === -1) {
    throw new Error(`Invalid AI task route "${raw}" for ${envKey}. Expected "<provider>:<model>".`);
  }
  const providerName = raw.slice(0, separatorIndex);
  const model = raw.slice(separatorIndex + 1);
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Unknown AI provider "${providerName}" configured for ${envKey}="${raw}".`);
  }
  return { provider, model };
}

export async function completeTask(
  task: AITask,
  req: Omit<AICompletionRequest, "model">,
): Promise<AICompletionResult> {
  const { provider, model } = resolveRoute(task);
  return provider.complete({ ...req, model });
}

export async function completeTaskStructured<T = unknown>(
  task: AITask,
  req: Omit<AIStructuredRequest, "model">,
): Promise<AIStructuredResult<T>> {
  const { provider, model } = resolveRoute(task);
  return provider.completeStructured<T>({ ...req, model });
}
