import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { seedDemoData } from "@/db/seed";
import type { DiscordInteraction } from "@/lib/discord/types";

function fakeInteraction(overrides: Partial<DiscordInteraction>): DiscordInteraction {
  return {
    id: "interaction-1",
    application_id: "app-1",
    type: 3,
    token: "token-1",
    guild_id: undefined,
    member: { user: { id: "888888888888888888", username: "recordplayer" } },
    data: {},
    ...overrides,
  };
}

describe("/record", () => {
  let deckId: string;
  let opponentDeckId: string;
  let opponentLabel: string;
  let guildId: string;

  beforeAll(async () => {
    guildId = "guild-under-test-record";
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

  it("walks deck -> opponent -> result -> play/draw -> notable(non-misplay) and persists a match + game", async () => {
    const { handleRecordCommand, handleRecordComponent } = await import("./record");

    const base = fakeInteraction({ guild_id: guildId });

    // /record
    const top = await handleRecordCommand(base);
    expect(JSON.stringify(top.immediate)).toContain("record:deck:select");

    // Choose deck -> opponent select
    const opponentStep = await handleRecordComponent(
      fakeInteraction({ guild_id: guildId, data: { custom_id: "record:deck:select", values: [deckId] } }),
    );
    expect(JSON.stringify(opponentStep.immediate)).toContain(`record:opponent:select:${deckId}`);

    // Choose opponent -> result buttons
    const resultStep = await handleRecordComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `record:opponent:select:${deckId}`, values: [opponentDeckId] },
      }),
    );
    const resultStepJson = JSON.stringify(resultStep.immediate);
    expect(resultStepJson).toContain(`record:result:${deckId}:${opponentLabel}:win`);

    // Choose result -> play/draw buttons
    const playDrawStep = await handleRecordComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `record:result:${deckId}:${opponentLabel}:win` },
      }),
    );
    expect(JSON.stringify(playDrawStep.immediate)).toContain(
      `record:playdraw:${deckId}:${opponentLabel}:win:play`,
    );

    // Choose play -> match is persisted, notable-tag buttons shown
    const notableStep = await handleRecordComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `record:playdraw:${deckId}:${opponentLabel}:win:play` },
      }),
    );
    const notableJson = JSON.stringify(notableStep.immediate);
    expect(notableJson).toContain("Match recorded");
    expect(notableJson).toMatch(/record:notable:[0-9a-f-]+:mulligan/);

    const [createdPlayer] = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.discordUserId, "888888888888888888"));
    expect(createdPlayer).toBeDefined();

    const [match] = await db
      .select()
      .from(schema.matches)
      .where(
        and(
          eq(schema.matches.playerId, createdPlayer.id),
          eq(schema.matches.deckId, deckId),
          eq(schema.matches.opponentDeckLabel, opponentLabel),
        ),
      );
    expect(match).toBeDefined();
    expect(match.result).toBe("win");
    expect(match.kind).toBe("practice");

    // Tap a non-misplay notable tag ("great_line") -> a games row is inserted directly.
    const gotIt = await handleRecordComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `record:notable:${match.id}:great_line` },
      }),
    );
    expect(JSON.stringify(gotIt.immediate)).toContain("Got it");

    const [game] = await db.select().from(schema.games).where(eq(schema.games.matchId, match.id));
    expect(game).toBeDefined();
    expect(game.noteTag).toBe("great_line");
    expect(game.result).toBe("win");
  });

  it("opens a modal for the misplay tag and persists the note on submit", async () => {
    const { handleRecordCommand, handleRecordComponent, handleRecordModalSubmit } = await import("./record");

    // Fresh flow to get a second match to attach the misplay note to.
    await handleRecordCommand(fakeInteraction({ guild_id: guildId }));
    const opponentStep = await handleRecordComponent(
      fakeInteraction({ guild_id: guildId, data: { custom_id: "record:deck:select", values: [deckId] } }),
    );
    expect(opponentStep.immediate).toBeDefined();

    const playDrawStep = await handleRecordComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `record:opponent:select:${deckId}`, values: [opponentDeckId] },
      }),
    );
    expect(playDrawStep.immediate).toBeDefined();

    const notableStep = await handleRecordComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `record:result:${deckId}:${opponentLabel}:loss` },
      }),
    );
    expect(notableStep.immediate).toBeDefined();

    const matchStep = await handleRecordComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `record:playdraw:${deckId}:${opponentLabel}:loss:draw` },
      }),
    );
    const matchStepJson = JSON.stringify(matchStep.immediate);
    const matchIdFromCustomId = matchStepJson.match(/record:notable:([0-9a-f-]+):mulligan/)?.[1];
    expect(matchIdFromCustomId).toBeDefined();

    // Tap "Misplay" -> modal response.
    const modalStep = await handleRecordComponent(
      fakeInteraction({
        guild_id: guildId,
        data: { custom_id: `record:notable:${matchIdFromCustomId}:misplay` },
      }),
    );
    const modalJson = JSON.stringify(modalStep.immediate);
    expect(modalJson).toContain(`record:misplaymodal:${matchIdFromCustomId}`);
    expect(modalJson).toContain("misplay_note");

    // Submit the modal.
    const submitResult = await handleRecordModalSubmit(
      fakeInteraction({
        guild_id: guildId,
        type: 5,
        data: {
          custom_id: `record:misplaymodal:${matchIdFromCustomId}`,
          components: [
            {
              type: 18,
              component: { custom_id: "misplay_note", value: "Overcommitted into a board wipe on turn 5" },
            },
          ],
        },
      }),
    );
    expect(JSON.stringify(submitResult.immediate)).toContain("Overcommitted into a board wipe on turn 5");

    const [game] = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.matchId, matchIdFromCustomId!));
    expect(game).toBeDefined();
    expect(game.noteTag).toBe("misplay");
    expect(game.noteDetail).toBe("Overcommitted into a board wipe on turn 5");
    expect(game.result).toBe("loss");
  });
});
