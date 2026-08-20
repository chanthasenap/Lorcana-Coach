/**
 * Manual smoke test for the ScenarioGenerator agent against real seed data
 * and a live Anthropic call. Not part of the automated test suite (that
 * uses a mock provider) - this is for eyeballing real output quality.
 *
 * Run with: npx tsx scripts/dev-try-scenario.ts
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { generateMatchupScenario } from "../src/lib/agents/scenarioGenerator";

async function main() {
  const [team] = await db.select().from(schema.teams).limit(1);
  if (!team) throw new Error("No team found - run `npm run db:seed` first.");

  const [deck] = await db
    .select()
    .from(schema.decks)
    .where(and(eq(schema.decks.teamId, team.id), eq(schema.decks.isOpponentArchetype, false)))
    .limit(1);
  if (!deck) throw new Error("No team-owned deck found.");

  const scenario = await generateMatchupScenario({
    teamId: team.id,
    deckId: deck.id,
    opponentLabel: "Amber/Steel",
  });

  console.log(JSON.stringify(scenario, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
