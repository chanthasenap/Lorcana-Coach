import { describe, it, expect, beforeAll, vi } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { seedDemoData } from "@/db/seed";
import { registerProviderForTesting } from "@/lib/ai";
import type { AIProvider } from "@/lib/ai/types";
import type { DiscordInteraction } from "@/lib/discord/types";

// The final step of scenario generation edits the original interaction
// response via Discord's webhook endpoint - mock that boundary so this test
// exercises real routing/DB logic without needing real network access.
vi.mock("@/lib/discord/rest", () => ({
  editOriginalInteractionResponse: vi.fn().mockResolvedValue(undefined),
  createFollowupMessage: vi.fn().mockResolvedValue(undefined),
}));

const FAKE_CONTENT = {
  options: { A: "Play it safe.", B: "Go aggressive.", C: "Hold everything.", D: "Mulligan mentally." },
  correctAnswer: "B" as const,
  category: "sequencing" as const,
  explanation: "Going aggressive punishes their open turn.",
  teamLearning: "Grounded in seeded observations for this matchup.",
  alternativeLine: "Playing safe is fine if you're far ahead.",
  coachNote: "Pressure openings when you can.",
};

function fakeInteraction(overrides: Partial<DiscordInteraction>): DiscordInteraction {
  return {
    id: "interaction-1",
    application_id: "app-1",
    type: 3,
    token: "token-1",
    guild_id: undefined,
    member: { user: { id: "999999999999999999", username: "testplayer" } },
    data: {},
    ...overrides,
  };
}

describe("/practice vertical slice", () => {
  let deckId: string;
  let opponentDeckId: string;
  let opponentLabel: string;
  let guildId: string;

  beforeAll(async () => {
    const provider: AIProvider = {
      name: "mock-practice",
      async complete() {
        throw new Error("not used");
      },
      async completeStructured<T>() {
        return { data: FAKE_CONTENT as T };
      },
    };
    registerProviderForTesting("mock-practice", provider);
    process.env.AI_TASK_SCENARIO_GENERATION = "mock-practice:test-model";

    guildId = "guild-under-test";
    process.env.DISCORD_DEV_GUILD_ID = guildId;
    await seedDemoData();

    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.discordGuildId, guildId));
    const [deck] = await db
      .select()
      .from(schema.decks)
      .where(and(eq(schema.decks.teamId, team.id), eq(schema.decks.isOpponentArchetype, false)))
      .limit(1);
    const [oppDeck] = await db
      .select()
      .from(schema.decks)
      .where(and(eq(schema.decks.teamId, team.id), eq(schema.decks.isOpponentArchetype, true)))
      .limit(1);

    deckId = deck.id;
    opponentDeckId = oppDeck.id;
    opponentLabel = oppDeck.inkColors.join("/");
  });

  it("walks a brand-new Discord user through the full loop and persists results", async () => {
    const { handlePracticeCommand, handlePracticeComponent } = await import("./practice");

    const base = fakeInteraction({ guild_id: guildId });

    // /practice
    const top = await handlePracticeCommand(base);
    expect(JSON.stringify(top.immediate)).toContain("practice:top:matchup");

    // A brand-new Discord user should be auto-registered as a player.
    const [player] = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.discordUserId, "999999999999999999"));
    expect(player).toBeUndefined(); // not created until they actually interact

    // Matchup Practice -> deck select
    const deckStep = await handlePracticeComponent(
      fakeInteraction({ guild_id: guildId, data: { custom_id: "practice:top:matchup" } }),
    );
    expect(JSON.stringify(deckStep.immediate)).toContain("practice:deck:select");

    const [createdPlayer] = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.discordUserId, "999999999999999999"));
    expect(createdPlayer).toBeDefined();

    // Choose deck -> opponent select
    const opponentStep = await handlePracticeComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: "practice:deck:select", values: [deckId] },
      }),
    );
    expect(JSON.stringify(opponentStep.immediate)).toContain(`practice:opponent:select:${deckId}`);

    // Choose opponent -> practice type buttons
    const typeStep = await handlePracticeComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `practice:opponent:select:${deckId}`, values: [opponentDeckId] },
      }),
    );
    const typeStepJson = JSON.stringify(typeStep.immediate);
    expect(typeStepJson).toContain(`practice:type:scenario:${deckId}:${opponentLabel}`);

    // Scenario Practice -> deferred ack, then background generation
    const scenarioStep = await handlePracticeComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `practice:type:scenario:${deckId}:${opponentLabel}` },
      }),
    );
    expect(scenarioStep.deferred).toBeTypeOf("function");
    await scenarioStep.deferred!();

    const { editOriginalInteractionResponse } = await import("@/lib/discord/rest");
    expect(editOriginalInteractionResponse).toHaveBeenCalledTimes(1);
    const editedPayload = (editOriginalInteractionResponse as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(JSON.stringify(editedPayload)).toContain("Your Decision");

    const [scenario] = await db
      .select()
      .from(schema.practiceScenarios)
      .orderBy(desc(schema.practiceScenarios.createdAt))
      .limit(1);
    expect(scenario).toBeDefined();
    expect(scenario.deckId).toBe(deckId);

    // Answer the scenario (chosen = correct answer "B")
    const answerStep = await handlePracticeComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `practice:answer:${scenario.id}:B` },
      }),
    );
    expect(JSON.stringify(answerStep.immediate)).toContain("Strong Play");

    const [attempt] = await db
      .select()
      .from(schema.scenarioAttempts)
      .where(eq(schema.scenarioAttempts.scenarioId, scenario.id));
    expect(attempt).toBeDefined();
    expect(attempt.correct).toBe(true);
    expect(attempt.playerId).toBe(createdPlayer.id);
  });
});
