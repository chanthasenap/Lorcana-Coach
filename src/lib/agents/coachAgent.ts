import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { PracticeCategory } from "./scenarioGenerator";

const { matches, scenarioAttempts, aiObservations, decks } = schema;

export type CoachPriority = {
  label: string;
  detail: string;
  buttonLabel: string;
  deckId: string;
  opponentLabel: string;
  category?: PracticeCategory;
};

type MatchupStat = { opponentLabel: string; deckId: string; wins: number; total: number };

function winRate(stat: MatchupStat): number {
  return stat.total === 0 ? 0 : stat.wins / stat.total;
}

/**
 * Personalized (falling back to team-wide) training priorities - pure data
 * aggregation, no AI call. Keeps `/coach` fast (no defer needed) and keeps
 * the recommendations traceable to real numbers rather than AI guesses.
 */
export async function buildCoachPriorities(teamId: string, playerId: string): Promise<CoachPriority[]> {
  const priorities: CoachPriority[] = [];

  const matchupStat = await worstMatchup(teamId, playerId);
  if (matchupStat) {
    const pct = Math.round(winRate(matchupStat) * 100);
    priorities.push({
      label: `${matchupStat.opponentLabel} matchup`,
      detail: `${pct}% win rate over your last ${matchupStat.total} recorded games`,
      buttonLabel: `Practice ${matchupStat.opponentLabel}`,
      deckId: matchupStat.deckId,
      opponentLabel: matchupStat.opponentLabel,
    });
  }

  const categoryWeakness = await worstCategory(teamId, playerId);
  if (categoryWeakness) {
    const fallbackDeckId = matchupStat?.deckId ?? (await anyTeamDeckId(teamId));
    const fallbackOpponent = matchupStat?.opponentLabel ?? "the field";
    priorities.push({
      label: `${formatCategory(categoryWeakness.category)} decisions`,
      detail: categoryWeakness.detail,
      buttonLabel: `Practice ${formatCategory(categoryWeakness.category)}`,
      deckId: fallbackDeckId,
      opponentLabel: fallbackOpponent,
      category: categoryWeakness.category,
    });
  }

  return priorities.slice(0, 3);
}

async function worstMatchup(teamId: string, playerId: string): Promise<MatchupStat | null> {
  const rows = await db
    .select()
    .from(matches)
    .where(and(eq(matches.teamId, teamId), eq(matches.playerId, playerId)));

  const source = rows.length >= 3 ? rows : await db.select().from(matches).where(eq(matches.teamId, teamId));

  const byMatchup = new Map<string, MatchupStat>();
  for (const m of source) {
    if (!m.opponentDeckLabel) continue;
    const key = `${m.deckId}:${m.opponentDeckLabel}`;
    const entry = byMatchup.get(key) ?? {
      opponentLabel: m.opponentDeckLabel,
      deckId: m.deckId,
      wins: 0,
      total: 0,
    };
    entry.total += 1;
    if (m.result === "win") entry.wins += 1;
    byMatchup.set(key, entry);
  }

  const eligible = [...byMatchup.values()].filter((s) => s.total >= 3);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => winRate(a) - winRate(b));
  return eligible[0];
}

async function worstCategory(
  teamId: string,
  playerId: string,
): Promise<{ category: PracticeCategory; detail: string } | null> {
  const attempts = await db
    .select({ category: scenarioAttempts.category, correct: scenarioAttempts.correct })
    .from(scenarioAttempts)
    .where(eq(scenarioAttempts.playerId, playerId));

  if (attempts.length >= 5) {
    const byCategory = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      const entry = byCategory.get(a.category) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (a.correct) entry.correct += 1;
      byCategory.set(a.category, entry);
    }
    const eligible = [...byCategory.entries()].filter(([, v]) => v.total >= 2);
    if (eligible.length > 0) {
      eligible.sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);
      const [category, stat] = eligible[0];
      const pct = Math.round((stat.correct / stat.total) * 100);
      return {
        category: category as PracticeCategory,
        detail: `${pct}% accuracy over your last ${stat.total} scenarios in this category`,
      };
    }
  }

  // Cold start: no practice history yet - fall back to the team's most
  // frequently observed problem category instead of inventing anything.
  const observations = await db
    .select({ category: aiObservations.category })
    .from(aiObservations)
    .where(eq(aiObservations.teamId, teamId));
  if (observations.length === 0) return null;

  const counts = new Map<string, number>();
  for (const o of observations) counts.set(o.category, (counts.get(o.category) ?? 0) + 1);
  const [topCategory, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    category: topCategory as PracticeCategory,
    detail: `Below team average - flagged in ${count} team observation${count === 1 ? "" : "s"} so far`,
  };
}

async function anyTeamDeckId(teamId: string): Promise<string> {
  const [deck] = await db
    .select()
    .from(decks)
    .where(and(eq(decks.teamId, teamId), eq(decks.isOpponentArchetype, false)))
    .limit(1);
  if (!deck) throw new Error("Team has no decks recorded yet.");
  return deck.id;
}

function formatCategory(category: PracticeCategory): string {
  return category
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
