import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DiscordInteraction } from "./types";
import { interactionUser } from "./types";

const { teams, players, teamMembers } = schema;

/**
 * Resolves (and lazily creates) the Team + Player + membership row for
 * whoever is running a command, keyed off their Discord guild/user IDs.
 * This is deliberately permissive for the MVP: any server member who runs a
 * command becomes a "player" on the team automatically (default role
 * "player") rather than requiring separate admin setup - the spec's
 * definition of done expects a team member to just run `/practice` and go.
 */
export async function resolvePlayerContext(interaction: DiscordInteraction) {
  const discordUser = interactionUser(interaction);
  if (!discordUser) {
    throw new Error("Interaction has no associated Discord user.");
  }

  const team = await resolveTeam(interaction.guild_id);
  const player = await resolvePlayer(discordUser.id, discordUser.global_name ?? discordUser.username);

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.playerId, player.id));
  if (!membership) {
    await db.insert(teamMembers).values({ teamId: team.id, playerId: player.id, role: "player" });
  }

  return { team, player };
}

async function resolveTeam(guildId: string | undefined) {
  if (guildId) {
    const [byGuild] = await db.select().from(teams).where(eq(teams.discordGuildId, guildId)).limit(1);
    if (byGuild) return byGuild;
  }

  // Single-team MVP fallback: use whichever team exists, and link this
  // guild to it so future lookups are direct.
  const [anyTeam] = await db.select().from(teams).limit(1);
  if (!anyTeam) {
    throw new Error("No team exists yet. Run the seed script or create a team first.");
  }
  if (guildId && !anyTeam.discordGuildId) {
    await db.update(teams).set({ discordGuildId: guildId }).where(eq(teams.id, anyTeam.id));
    return { ...anyTeam, discordGuildId: guildId };
  }
  return anyTeam;
}

async function resolvePlayer(discordUserId: string, displayName: string) {
  const [existing] = await db.select().from(players).where(eq(players.discordUserId, discordUserId)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(players)
    .values({ discordUserId, displayName })
    .returning();
  return created;
}
