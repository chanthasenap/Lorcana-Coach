import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

const { matches, players, decks, aiObservations } = schema;

export type MatchupRow = {
  opponentLabel: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRatePct: number;
};

export type RecentMatchRow = {
  id: string;
  playedAt: Date;
  playerName: string;
  deckName: string;
  opponentLabel: string;
  result: "win" | "loss" | "draw";
  gameCount: number;
};

export type RecentObservationRow = {
  id: string;
  observation: string;
  category: string;
  confidence: number;
  matchupKey: string | null;
  createdAt: Date;
};

export type TeamDashboardStats = {
  overall: { wins: number; losses: number; draws: number; total: number; winRatePct: number };
  matchupTable: MatchupRow[];
  recentMatches: RecentMatchRow[];
  recentObservations: RecentObservationRow[];
};

/**
 * Pure aggregation over the team's own recorded data - no AI calls, so this
 * loads fast on every dashboard visit. Mirrors the "structured data over
 * AI-generated text" principle: the dashboard shows real numbers, and the
 * AI observations feed is shown as supporting context underneath.
 */
export async function getTeamDashboardStats(teamId: string, limit = 15): Promise<TeamDashboardStats> {
  const rows = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      result: matches.result,
      gameCount: matches.gameCount,
      opponentDeckLabel: matches.opponentDeckLabel,
      playerName: players.displayName,
      deckName: decks.name,
    })
    .from(matches)
    .innerJoin(players, eq(matches.playerId, players.id))
    .innerJoin(decks, eq(matches.deckId, decks.id))
    .where(eq(matches.teamId, teamId))
    .orderBy(desc(matches.playedAt));

  const overall = { wins: 0, losses: 0, draws: 0, total: 0, winRatePct: 0 };
  const byOpponent = new Map<string, MatchupRow>();

  for (const m of rows) {
    overall.total += 1;
    if (m.result === "win") overall.wins += 1;
    else if (m.result === "loss") overall.losses += 1;
    else overall.draws += 1;

    const label = m.opponentDeckLabel ?? "Unknown";
    const entry = byOpponent.get(label) ?? { opponentLabel: label, wins: 0, losses: 0, draws: 0, total: 0, winRatePct: 0 };
    entry.total += 1;
    if (m.result === "win") entry.wins += 1;
    else if (m.result === "loss") entry.losses += 1;
    else entry.draws += 1;
    byOpponent.set(label, entry);
  }
  overall.winRatePct = overall.total === 0 ? 0 : Math.round((overall.wins / overall.total) * 100);

  const matchupTable = [...byOpponent.values()]
    .map((r) => ({ ...r, winRatePct: r.total === 0 ? 0 : Math.round((r.wins / r.total) * 100) }))
    .sort((a, b) => b.total - a.total);

  const recentMatches: RecentMatchRow[] = rows.slice(0, limit).map((m) => ({
    id: m.id,
    playedAt: m.playedAt,
    playerName: m.playerName,
    deckName: m.deckName,
    opponentLabel: m.opponentDeckLabel ?? "Unknown",
    result: m.result,
    gameCount: m.gameCount,
  }));

  const observationRows = await db
    .select({
      id: aiObservations.id,
      observation: aiObservations.observation,
      category: aiObservations.category,
      confidence: aiObservations.confidence,
      matchupKey: aiObservations.matchupKey,
      createdAt: aiObservations.createdAt,
    })
    .from(aiObservations)
    .where(eq(aiObservations.teamId, teamId))
    .orderBy(desc(aiObservations.createdAt))
    .limit(limit);

  return { overall, matchupTable, recentMatches, recentObservations: observationRows };
}
