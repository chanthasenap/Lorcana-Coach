// Every AI-touching feature routes through one of these tasks, so the
// provider/model used for it is a config change (env var), never a code
// change. See AI_TASK_* in .env.example.
export type AITask =
  | "scenario_generation"
  | "game_analysis"
  | "coaching"
  | "rules"
  | "pattern_detection"
  | "team_strategy";

export type AIMessage = { role: "user" | "assistant"; content: string };

export type AICompletionRequest = {
  model: string;
  system?: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
};

export type AICompletionResult = {
  text: string;
};

export type AIStructuredRequest = AICompletionRequest & {
  /** Name of the "tool"/function the model must call - just an identifier, not user-facing. */
  toolName: string;
  toolDescription: string;
  /** JSON Schema (subset) describing the required output shape. */
  schema: Record<string, unknown>;
};

export type AIStructuredResult<T = unknown> = {
  data: T;
};

export interface AIProvider {
  readonly name: string;
  complete(req: AICompletionRequest): Promise<AICompletionResult>;
  /** Forces the model to return data matching `schema` instead of free text. */
  completeStructured<T = unknown>(req: AIStructuredRequest): Promise<AIStructuredResult<T>>;
}
