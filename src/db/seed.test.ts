import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "./index";
import { seedDemoData } from "./seed";

// Runs against DATABASE_URL (the local dev Postgres) - it resets and
// repopulates the demo team, so don't point DATABASE_URL at a database with
// data you care about when running tests.
describe("seedDemoData", () => {
  it("is idempotent and produces internally-consistent demo data", async () => {
    await seedDemoData();
    const second = await seedDemoData();

    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, second.teamId));
    expect(team).toBeDefined();
    expect(team.name).toBe("Ink Well Collective");

    const players = await db.select().from(schema.players);
    expect(players).toHaveLength(4);

    const decks = await db.select().from(schema.decks).where(eq(schema.decks.teamId, second.teamId));
    expect(decks.length).toBeGreaterThanOrEqual(7);

    const matches = await db.select().from(schema.matches).where(eq(schema.matches.teamId, second.teamId));
    expect(matches.length).toBeGreaterThan(0);

    // Every match should have exactly one game recorded against it (seed
    // always records game 1 alongside the match).
    const games = await db.select().from(schema.games);
    expect(games.length).toBe(matches.length);

    const observations = await db
      .select()
      .from(schema.aiObservations)
      .where(eq(schema.aiObservations.teamId, second.teamId));
    expect(observations.length).toBeGreaterThan(0);

    // Running the seed twice should not accumulate duplicate teams.
    const allTeams = await db.select().from(schema.teams);
    expect(allTeams).toHaveLength(1);
  });
});
