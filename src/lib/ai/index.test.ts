import { describe, it, expect, afterEach } from "vitest";
import { completeTask, completeTaskStructured, registerProviderForTesting, resolveRoute } from "./index";
import type { AIProvider } from "./types";

describe("AI task routing", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("resolves the configured provider:model for a task", () => {
    process.env.AI_TASK_COACHING = "anthropic:claude-haiku-4-5";
    const { provider, model } = resolveRoute("coaching");
    expect(provider.name).toBe("anthropic");
    expect(model).toBe("claude-haiku-4-5");
  });

  it("falls back to a sane default when the env var is unset", () => {
    delete process.env.AI_TASK_RULES;
    const { provider, model } = resolveRoute("rules");
    expect(provider.name).toBe("anthropic");
    expect(model.length).toBeGreaterThan(0);
  });

  it("throws for an unknown provider name", () => {
    process.env.AI_TASK_TEAM_STRATEGY = "made-up-provider:some-model";
    expect(() => resolveRoute("team_strategy")).toThrow(/Unknown AI provider/);
  });

  it("throws for a malformed route missing a colon", () => {
    process.env.AI_TASK_PATTERN_DETECTION = "anthropic-claude-haiku";
    expect(() => resolveRoute("pattern_detection")).toThrow(/Invalid AI task route/);
  });

  it("routes completeTask through the resolved provider with a mock", async () => {
    const calls: unknown[] = [];
    const mock: AIProvider = {
      name: "mock",
      async complete(req) {
        calls.push(req);
        return { text: "mock response" };
      },
      async completeStructured() {
        throw new Error("not used in this test");
      },
    };
    registerProviderForTesting("mock", mock);
    process.env.AI_TASK_COACHING = "mock:test-model";

    const result = await completeTask("coaching", { messages: [{ role: "user", content: "hi" }] });

    expect(result.text).toBe("mock response");
    expect(calls).toHaveLength(1);
    expect((calls[0] as { model: string }).model).toBe("test-model");
  });

  it("routes completeTaskStructured through the resolved provider with a mock", async () => {
    const mock: AIProvider = {
      name: "mock-structured",
      async complete() {
        throw new Error("not used in this test");
      },
      async completeStructured<T>() {
        return { data: { ok: true } as T };
      },
    };
    registerProviderForTesting("mock-structured", mock);
    process.env.AI_TASK_SCENARIO_GENERATION = "mock-structured:test-model";

    const result = await completeTaskStructured<{ ok: boolean }>("scenario_generation", {
      messages: [{ role: "user", content: "hi" }],
      toolName: "test_tool",
      toolDescription: "test",
      schema: { type: "object", properties: {} },
    });

    expect(result.data.ok).toBe(true);
  });
});
