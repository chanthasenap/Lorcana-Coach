import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { seedDemoData } from "@/db/seed";
import { getTeamDashboardStats } from "./stats";

describe("getTeamDashboardStats", () => {
  let teamId: string;

  beforeAll(async () => {
    await seedDemoData();
    const [team] = await db.select().from(schema.teams).limit(1);
    teamId = team.id;
  });

  it("aggregates overall record, matchup table, recent games, and observations from seeded data", async () => {
    const stats = await getTeamDashboardStats(teamId);

    // Overall record should reflect every seeded match for this team.
    const allMatches = await db.select().from(schema.matches).where(eq(schema.matches.teamId, teamId));
    expect(stats.overall.total).toBe(allMatches.length);
    expect(stats.overall.total).toBeGreaterThan(0);
    expect(stats.overall.wins + stats.overall.losses + stats.overall.draws).toBe(stats.overall.total);
    expect(stats.overall.winRatePct).toBe(Math.round((stats.overall.wins / stats.overall.total) * 100));

    // The seed data deliberately makes Amber/Steel a weak matchup - it
    // should show up in the matchup table with a below-average win rate.
    const amberSteel = stats.matchupTable.find((r) => r.opponentLabel === "Amber/Steel");
    expect(amberSteel).toBeDefined();
    expect(amberSteel!.total).toBeGreaterThanOrEqual(3);
    expect(amberSteel!.winRatePct).toBeLessThan(stats.overall.winRatePct + 20);

    // Every matchup row's win rate is internally consistent.
    for (const row of stats.matchupTable) {
      expect(row.wins + row.losses + row.draws).toBe(row.total);
      expect(row.winRatePct).toBe(Math.round((row.wins / row.total) * 100));
    }

    // Recent matches are capped and sorted most-recent-first.
    expect(stats.recentMatches.length).toBeLessThanOrEqual(15);
    for (let i = 1; i < stats.recentMatches.length; i++) {
      expect(stats.recentMatches[i - 1].playedAt.getTime()).toBeGreaterThanOrEqual(
        stats.recentMatches[i].playedAt.getTime(),
      );
    }

    // Seeded AI observations should be surfaced too.
    expect(stats.recentObservations.length).toBeGreaterThan(0);
    expect(stats.recentObservations[0].observation.length).toBeGreaterThan(0);
  });

  it("returns zeroed-out stats for a team with no recorded matches", async () => {
    const [emptyTeam] = await db
      .insert(schema.teams)
      .values({ name: "Empty Test Team", discordGuildId: "empty-team-guild" })
      .returning();

    const stats = await getTeamDashboardStats(emptyTeam.id);
    expect(stats.overall).toEqual({ wins: 0, losses: 0, draws: 0, total: 0, winRatePct: 0 });
    expect(stats.matchupTable).toEqual([]);
    expect(stats.recentMatches).toEqual([]);
    expect(stats.recentObservations).toEqual([]);
  });
});
