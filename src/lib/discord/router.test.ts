import { describe, it, expect, vi } from "vitest";
import type { DiscordInteraction } from "./types";

// Router dispatch is pure control flow - mock every command handler so this
// test exercises only the routing rules (command name / custom_id namespace
// -> handler, plus the fallback branches) without touching the DB or AI.
vi.mock("./commands/help", () => ({ handleHelp: vi.fn(async () => ({ immediate: { marker: "help" } })) }));
vi.mock("./commands/practice", () => ({
  handlePracticeCommand: vi.fn(async () => ({ immediate: { marker: "practice-command" } })),
  handlePracticeComponent: vi.fn(async () => ({ immediate: { marker: "practice-component" } })),
}));
vi.mock("./commands/coach", () => ({
  handleCoachCommand: vi.fn(async () => ({ immediate: { marker: "coach-command" } })),
  handleCoachComponent: vi.fn(async () => ({ immediate: { marker: "coach-component" } })),
}));
vi.mock("./commands/record", () => ({
  handleRecordCommand: vi.fn(async () => ({ immediate: { marker: "record-command" } })),
  handleRecordComponent: vi.fn(async () => ({ immediate: { marker: "record-component" } })),
  handleRecordModalSubmit: vi.fn(async () => ({ immediate: { marker: "record-modal" } })),
}));
vi.mock("./commands/analyze", () => ({
  handleAnalyzeCommand: vi.fn(async () => ({ immediate: { marker: "analyze-command" } })),
}));

const APPLICATION_COMMAND = 2;
const MESSAGE_COMPONENT = 3;
const MODAL_SUBMIT = 5;

function fakeInteraction(overrides: Partial<DiscordInteraction>): DiscordInteraction {
  return {
    id: "interaction-1",
    application_id: "app-1",
    type: APPLICATION_COMMAND,
    token: "token-1",
    data: {},
    ...overrides,
  };
}

describe("routeInteraction", () => {
  it("dispatches slash commands by name", async () => {
    const { routeInteraction } = await import("./router");

    const cases: [string, string][] = [
      ["practice", "practice-command"],
      ["coach", "coach-command"],
      ["record", "record-command"],
      ["analyze", "analyze-command"],
      ["help", "help"],
    ];

    for (const [name, marker] of cases) {
      const result = await routeInteraction(fakeInteraction({ data: { name } }));
      expect(result.immediate).toEqual({ marker });
    }
  });

  it("replies with an 'unknown command' message for an unrecognized command name", async () => {
    const { routeInteraction } = await import("./router");
    const result = await routeInteraction(fakeInteraction({ data: { name: "not-a-real-command" } }));
    expect(JSON.stringify(result.immediate)).toContain("Unknown command");
  });

  it("dispatches message components by custom_id namespace", async () => {
    const { routeInteraction } = await import("./router");

    const cases: [string, string][] = [
      ["practice:deck:select", "practice-component"],
      ["coach:whatever", "coach-component"],
      ["record:deck:select", "record-component"],
    ];

    for (const [customId, marker] of cases) {
      const result = await routeInteraction(
        fakeInteraction({ type: MESSAGE_COMPONENT, data: { custom_id: customId } }),
      );
      expect(result.immediate).toEqual({ marker });
    }
  });

  it("routes record modal submits to handleRecordModalSubmit, not handleRecordComponent", async () => {
    const { routeInteraction } = await import("./router");
    const result = await routeInteraction(
      fakeInteraction({ type: MODAL_SUBMIT, data: { custom_id: "record:misplaymodal:some-match-id" } }),
    );
    expect(result.immediate).toEqual({ marker: "record-modal" });
  });

  it("replies that the button/menu is no longer valid for an unrecognized component namespace", async () => {
    const { routeInteraction } = await import("./router");
    const result = await routeInteraction(
      fakeInteraction({ type: MESSAGE_COMPONENT, data: { custom_id: "ghost:whatever" } }),
    );
    expect(JSON.stringify(result.immediate)).toContain("no longer valid");
  });

  it("replies with 'unsupported interaction type' for anything else (e.g. PING already handled upstream)", async () => {
    const { routeInteraction } = await import("./router");
    const result = await routeInteraction(fakeInteraction({ type: 1, data: {} }));
    expect(JSON.stringify(result.immediate)).toContain("Unsupported interaction type");
  });
});
