import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { seedDemoData } from "@/db/seed";
import { buildCoachPriorities } from "./coachAgent";

describe("buildCoachPriorities", () => {
  let teamId: string;
  let playerId: string;

  beforeAll(async () => {
    await seedDemoData();
    const [team] = await db.select().from(schema.teams).limit(1);
    const [player] = await db.select().from(schema.players).limit(1);
    teamId = team.id;
    playerId = player.id;

    // Give this player enough games against Amber/Steel (seeded as the
    // team's deliberately weak matchup) to be individually eligible.
    const [deck] = await db
      .select()
      .from(schema.decks)
      .where(and(eq(schema.decks.teamId, teamId), eq(schema.decks.isOpponentArchetype, false)))
      .limit(1);

    await db.insert(schema.matches).values([
      { teamId, playerId, deckId: deck.id, opponentDeckLabel: "Amber/Steel", result: "loss" },
      { teamId, playerId, deckId: deck.id, opponentDeckLabel: "Amber/Steel", result: "loss" },
      { teamId, playerId, deckId: deck.id, opponentDeckLabel: "Amber/Steel", result: "win" },
      { teamId, playerId, deckId: deck.id, opponentDeckLabel: "Amber/Steel", result: "loss" },
    ]);
  });

  it("surfaces the worst matchup by win rate with a real percentage", async () => {
    const priorities = await buildCoachPriorities(teamId, playerId);
    expect(priorities.length).toBeGreaterThan(0);

    // Seed data has some randomness in win/loss + player assignment, so
    // assert shape (a real "<N>% win rate over <M> games" line grounded in
    // this player's own match history) rather than an exact percentage.
    const matchupPriority = priorities.find((p) => /matchup$/.test(p.label));
    expect(matchupPriority).toBeDefined();
    expect(matchupPriority!.detail).toMatch(/^\d+% win rate over your last \d+ recorded games$/);
    expect(matchupPriority!.buttonLabel).toContain(matchupPriority!.opponentLabel);
  });

  it("falls back to team-wide observations when the player has no scenario history", async () => {
    const priorities = await buildCoachPriorities(teamId, playerId);
    const categoryPriority = priorities.find((p) => p.category);
    expect(categoryPriority).toBeDefined();
    expect(categoryPriority!.detail.toLowerCase()).toContain("team observation");
  });

  it("switches to the player's own category accuracy once they have enough scenario attempts", async () => {
    const [scenario] = await db.select().from(schema.practiceScenarios).limit(1);
    let scenarioId = scenario?.id;
    if (!scenarioId) {
      const [deck] = await db.select().from(schema.decks).limit(1);
      const [created] = await db
        .insert(schema.practiceScenarios)
        .values({
          teamId,
          deckId: deck.id,
          opponentDeckLabel: "Amber/Steel",
          matchupKey: `${deck.id}:Amber/Steel`,
          situation: { turn: 4, yourLore: 2, opponentLore: 3, availableInk: 4, yourBoard: [], opponentBoard: [], hand: [] },
          question: "test",
          options: [
            { key: "A", label: "a" },
            { key: "B", label: "b" },
            { key: "C", label: "c" },
            { key: "D", label: "d" },
          ],
          correctAnswer: "A",
          aiExplanation: "test",
          category: "lore_race",
        })
        .returning();
      scenarioId = created.id;
    }

    // 4 wrong, 1 right on "lore_race" - should surface as the weak category.
    await db.insert(schema.scenarioAttempts).values([
      { scenarioId, playerId, chosenAnswer: "B", correct: false, category: "lore_race" },
      { scenarioId, playerId, chosenAnswer: "B", correct: false, category: "lore_race" },
      { scenarioId, playerId, chosenAnswer: "B", correct: false, category: "lore_race" },
      { scenarioId, playerId, chosenAnswer: "B", correct: false, category: "lore_race" },
      { scenarioId, playerId, chosenAnswer: "A", correct: true, category: "lore_race" },
    ]);

    const priorities = await buildCoachPriorities(teamId, playerId);
    const categoryPriority = priorities.find((p) => p.category === "lore_race");
    expect(categoryPriority).toBeDefined();
    expect(categoryPriority!.detail).toContain("20%"); // 1/5 correct
  });
});
