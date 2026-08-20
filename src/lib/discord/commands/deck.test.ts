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
    member: { user: { id: "777777777777777777", username: "deckimporter" } },
    data: {},
    ...overrides,
  };
}

function modalSubmit(customId: string, values: Record<string, string>): DiscordInteraction {
  return fakeInteraction({
    guild_id: "guild-under-test-deck",
    type: 5,
    data: {
      custom_id: customId,
      components: Object.entries(values).map(([id, value]) => ({
        type: 18,
        component: { custom_id: id, value },
      })),
    },
  });
}

describe("/deck", () => {
  let guildId: string;
  let teamId: string;

  beforeAll(async () => {
    guildId = "guild-under-test-deck";
    process.env.DISCORD_DEV_GUILD_ID = guildId;
    await seedDemoData();

    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.discordGuildId, guildId));
    teamId = team.id;
  });

  it("opens the kind-select buttons on /deck", async () => {
    const { handleDeckCommand } = await import("./deck");
    const top = await handleDeckCommand(fakeInteraction({ guild_id: guildId }));
    const json = JSON.stringify(top.immediate);
    expect(json).toContain("deck:import:own");
    expect(json).toContain("deck:import:opponent");
  });

  it("opens an import modal for 'My Deck'", async () => {
    const { handleDeckComponent } = await import("./deck");
    const step = await handleDeckComponent(
      fakeInteraction({ guild_id: guildId, data: { custom_id: "deck:import:own" } }),
    );
    const json = JSON.stringify(step.immediate);
    expect(json).toContain("deck:importmodal:own");
    expect(json).toContain("deck_name");
    expect(json).toContain("ink_colors");
    expect(json).toContain("decklist");
  });

  it("parses a pasted decklist and saves it as the player's own deck", async () => {
    const { handleDeckModalSubmit } = await import("./deck");

    const submit = await handleDeckModalSubmit(
      modalSubmit("deck:importmodal:own", {
        deck_name: "Test Amber/Steel Aggro",
        ink_colors: "Amber/Steel",
        decklist:
          "4 Elsa - Snow Queen\n4x Mickey Mouse - Brave Little Tailor\n2 Be Prepared\nnot a real line\n",
      }),
    );
    const json = JSON.stringify(submit.immediate);
    expect(json).toContain("Deck imported");
    expect(json).toContain("Test Amber/Steel Aggro");
    expect(json).toContain("guessed from naming patterns, not verified");
    expect(json).toContain("1 line couldn't be parsed");

    const [deck] = await db
      .select()
      .from(schema.decks)
      .where(and(eq(schema.decks.teamId, teamId), eq(schema.decks.name, "Test Amber/Steel Aggro")));
    expect(deck).toBeDefined();
    expect(deck.inkColors).toEqual(["Amber", "Steel"]);
    expect(deck.isOpponentArchetype).toBe(false);
    expect(deck.ownerPlayerId).not.toBeNull();
    expect(deck.decklist).toEqual([
      { card: "Elsa - Snow Queen", count: 4, type: "Character" },
      { card: "Mickey Mouse - Brave Little Tailor", count: 4, type: "Character" },
      { card: "Be Prepared", count: 2, type: "Action" },
    ]);
  });

  it("saves an opponent import as a teamless-owner archetype deck", async () => {
    const { handleDeckModalSubmit } = await import("./deck");

    await handleDeckModalSubmit(
      modalSubmit("deck:importmodal:opponent", {
        deck_name: "Test Ruby/Sapphire Control",
        ink_colors: "Ruby, Sapphire",
        decklist: "3 Elsa - Snow Queen\n1 Be Prepared",
      }),
    );

    const [deck] = await db
      .select()
      .from(schema.decks)
      .where(and(eq(schema.decks.teamId, teamId), eq(schema.decks.name, "Test Ruby/Sapphire Control")));
    expect(deck).toBeDefined();
    expect(deck.inkColors).toEqual(["Ruby", "Sapphire"]);
    expect(deck.isOpponentArchetype).toBe(true);
    expect(deck.ownerPlayerId).toBeNull();
  });

  it("rejects an import with no parseable decklist lines", async () => {
    const { handleDeckModalSubmit } = await import("./deck");

    const submit = await handleDeckModalSubmit(
      modalSubmit("deck:importmodal:own", {
        deck_name: "Empty Deck",
        ink_colors: "Amber",
        decklist: "not a valid line\nalso not valid",
      }),
    );
    const json = JSON.stringify(submit.immediate);
    expect(json).toContain("Couldn't import that deck");

    const rows = await db.select().from(schema.decks).where(eq(schema.decks.name, "Empty Deck"));
    expect(rows.length).toBe(0);
  });
});
