import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { seedDemoData } from "@/db/seed";
import { registerProviderForTesting } from "@/lib/ai";
import type { AIProvider } from "@/lib/ai/types";
import { generateMatchupScenario } from "./scenarioGenerator";

const FAKE_SCENARIO_CONTENT = {
  options: {
    A: "Develop the board and pass.",
    B: "Challenge the biggest threat before questing.",
    C: "Quest with everything for max lore.",
    D: "Hold everything back and pass.",
  },
  correctAnswer: "B" as const,
  category: "board_control" as const,
  explanation: "Removing the biggest threat first protects your lore lead.",
  teamLearning: "The team's own data favors removing threats before developing, per seeded observations.",
  alternativeLine: "Developing first is fine when you're far ahead on lore.",
  coachNote: "Answer the biggest threat before you build wider.",
};

describe("generateMatchupScenario", () => {
  beforeAll(async () => {
    await seedDemoData();

    const mockProvider: AIProvider = {
      name: "mock-scenario",
      async complete() {
        throw new Error("complete() should not be called by the scenario generator");
      },
      async completeStructured<T>() {
        return { data: FAKE_SCENARIO_CONTENT as T };
      },
    };
    registerProviderForTesting("mock-scenario", mockProvider);
    process.env.AI_TASK_SCENARIO_GENERATION = "mock-scenario:test-model";
  });

  it("builds a coherent scenario grounded in seeded team/deck data", async () => {
    const [team] = await db.select().from(schema.teams).limit(1);
    const [deck] = await db
      .select()
      .from(schema.decks)
      .where(and(eq(schema.decks.teamId, team.id), eq(schema.decks.isOpponentArchetype, false)))
      .limit(1);

    const scenario = await generateMatchupScenario({
      teamId: team.id,
      deckId: deck.id,
      opponentLabel: "Amber/Steel",
    });

    expect(scenario.teamId).toBe(team.id);
    expect(scenario.deckId).toBe(deck.id);
    expect(scenario.opponentDeckLabel).toBe("Amber/Steel");
    expect(scenario.correctAnswer).toBe("B");
    expect(scenario.category).toBe("board_control");
    expect(scenario.options).toHaveLength(4);
    expect(scenario.options.map((o) => o.key)).toEqual(["A", "B", "C", "D"]);
    expect(scenario.aiExplanation).toContain("biggest threat");
    expect(scenario.teamLearning).toBeTruthy();

    // Board state should be internally coherent: only characters on board,
    // lore totals below 20 (i.e. not already a won game), turn in range.
    const situation = scenario.situation as {
      turn: number;
      yourLore: number;
      opponentLore: number;
      yourBoard: string[];
    };
    expect(situation.turn).toBeGreaterThanOrEqual(3);
    expect(situation.turn).toBeLessThanOrEqual(8);
    expect(situation.yourLore).toBeLessThan(20);
    expect(situation.opponentLore).toBeLessThan(20);

    // This matchup has a seeded historical observation, so it should be
    // marked as grounded in real team data rather than generic.
    expect(scenario.sourceType).toBe("historical");

    const [persisted] = await db
      .select()
      .from(schema.practiceScenarios)
      .where(eq(schema.practiceScenarios.id, scenario.id));
    expect(persisted).toBeDefined();
  });
});
