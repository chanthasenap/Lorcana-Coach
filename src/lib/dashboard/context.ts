import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";

const { players, teamMembers, teams } = schema;

export type DashboardContext =
  | { state: "signed_out" }
  | { state: "not_linked"; discordUserId: string }
  | {
      state: "ready";
      player: typeof players.$inferSelect;
      team: typeof teams.$inferSelect;
      role: (typeof teamMembers.$inferSelect)["role"];
      otherTeams: (typeof teams.$inferSelect)[];
    };

/**
 * Resolves the signed-in web session to a Player/Team, using the SAME
 * Player rows the Discord bot creates - there's no separate "dashboard
 * account". A Discord user who has never run a slash command in their
 * team's server yet won't have a Player row, so they're sent back to
 * Discord first rather than getting a phantom, teamless dashboard.
 *
 * If a player belongs to more than one team (rare in MVP), we default to
 * their first membership and surface the rest as `otherTeams` for a future
 * team switcher - good enough for a single-team MVP.
 */
export async function getDashboardContext(): Promise<DashboardContext> {
  const session = await auth();
  const discordUserId = session?.discordUserId;
  if (!discordUserId) return { state: "signed_out" };

  const [player] = await db.select().from(players).where(eq(players.discordUserId, discordUserId)).limit(1);
  if (!player) return { state: "not_linked", discordUserId };

  const memberships = await db
    .select({ team: teams, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.playerId, player.id));

  if (memberships.length === 0) return { state: "not_linked", discordUserId };

  const [primary, ...rest] = memberships;
  return {
    state: "ready",
    player,
    team: primary.team,
    role: primary.role,
    otherTeams: rest.map((m) => m.team),
  };
}
