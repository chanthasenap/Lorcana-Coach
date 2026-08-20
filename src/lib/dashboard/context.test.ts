import { describe, it, expect, beforeAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { seedDemoData } from "@/db/seed";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

describe("getDashboardContext", () => {
  let teamId: string;
  let guildId: string;
  let linkedDiscordUserId: string;

  beforeAll(async () => {
    guildId = "guild-under-test-dashboard";
    process.env.DISCORD_DEV_GUILD_ID = guildId;
    await seedDemoData();

    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.discordGuildId, guildId));
    teamId = team.id;

    const [player] = await db
      .select({ discordUserId: schema.players.discordUserId })
      .from(schema.players)
      .innerJoin(schema.teamMembers, eq(schema.teamMembers.playerId, schema.players.id))
      .where(eq(schema.teamMembers.teamId, teamId))
      .limit(1);
    linkedDiscordUserId = player.discordUserId;
  });

  it("returns signed_out when there's no session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const { getDashboardContext } = await import("./context");
    const ctx = await getDashboardContext();
    expect(ctx.state).toBe("signed_out");
  });

  it("returns not_linked when the Discord account has no Player row", async () => {
    mockAuth.mockResolvedValueOnce({ discordUserId: "999999999999999000" });
    const { getDashboardContext } = await import("./context");
    const ctx = await getDashboardContext();
    expect(ctx.state).toBe("not_linked");
  });

  it("returns ready with the player's team and role when linked", async () => {
    mockAuth.mockResolvedValueOnce({ discordUserId: linkedDiscordUserId });
    const { getDashboardContext } = await import("./context");
    const ctx = await getDashboardContext();
    expect(ctx.state).toBe("ready");
    if (ctx.state === "ready") {
      expect(ctx.team.id).toBe(teamId);
      expect(ctx.player.discordUserId).toBe(linkedDiscordUserId);
      expect(["admin", "coach", "player", "guest"]).toContain(ctx.role);
    }
  });
});
