import { eq, or, ilike, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { completeTaskStructured } from "@/lib/ai";

const { decks, aiObservations, practiceScenarios, practiceCategoryEnum } = schema;

type Deck = typeof decks.$inferSelect;

const CATEGORY_VALUES = practiceCategoryEnum.enumValues;
export type PracticeCategory = (typeof CATEGORY_VALUES)[number];

const SCENARIO_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    // Anthropic structured outputs only support array minItems/maxItems of 0
    // or 1, so four fixed-key fields (rather than a 4-element array) is how
    // "exactly four options" gets enforced by the schema itself.
    options: {
      type: "object",
      description: "Four distinct, plausible plays for this board state.",
      properties: {
        A: { type: "string", description: "A concise, concrete description of the play, e.g. 'Challenge Character X with Character A, then quest with the rest.'" },
        B: { type: "string" },
        C: { type: "string" },
        D: { type: "string" },
      },
      required: ["A", "B", "C", "D"],
      additionalProperties: false,
    },
    correctAnswer: { type: "string", enum: ["A", "B", "C", "D"] },
    category: {
      type: "string",
      enum: CATEGORY_VALUES,
      description: "The primary skill this decision tests.",
    },
    explanation: {
      type: "string",
      description: "Strategic reasoning for why the correct answer is strong (the 'Why').",
    },
    teamLearning: {
      type: "string",
      description:
        "What this team's own history says about this kind of decision. If historical observations were provided, ground this in them concretely (cite the numbers). If none were provided, give a brief general strategic principle instead and do not invent statistics.",
    },
    alternativeLine: {
      type: "string",
      description: "A different viable line worth knowing, and when it would be right instead.",
    },
    coachNote: {
      type: "string",
      description: "One concise, memorable lesson - a single sentence.",
    },
  },
  required: ["options", "correctAnswer", "category", "explanation", "teamLearning", "alternativeLine", "coachNote"],
  additionalProperties: false,
};

type ScenarioContent = {
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: "A" | "B" | "C" | "D";
  category: (typeof CATEGORY_VALUES)[number];
  explanation: string;
  teamLearning: string;
  alternativeLine: string;
  coachNote: string;
};

function pickN<T>(arr: T[], n: number): T[] {
  if (arr.length === 0) return [];
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function deckCardNames(
  deck: Pick<Deck, "decklist" | "inkColors" | "name">,
  onlyCharacters = false,
): string[] {
  const entries = deck.decklist ?? [];
  const filtered = onlyCharacters ? entries.filter((c) => c.type === "Character") : entries;
  const names = filtered.map((c) => c.card);
  if (names.length > 0) return names;
  // Fallback for decks without a recorded decklist yet: generic but
  // ink-flavored placeholders rather than nothing.
  return deck.inkColors.map((ink, i) => `${ink} Character ${String.fromCharCode(65 + i)}`);
}

/** Simple, plausible-looking board state. Deliberately code, not AI - keeps
 * the numbers coherent (lore totals, ink, turn) without relying on an LLM
 * to do game-state arithmetic. */
function buildBoardState(ourDeck: Deck, opponentCharacterPool: string[]) {
  const turn = 3 + Math.floor(Math.random() * 6); // 3-8
  const yourLore = Math.min(18, Math.floor(Math.random() * (turn * 2)));
  const opponentLore = Math.min(19, Math.floor(Math.random() * (turn * 2 + 2)));
  const availableInk = Math.max(2, Math.min(10, turn + Math.floor(Math.random() * 2)));

  // Board slots must be characters (actions/songs don't stay in play); hand
  // can be any card type in the deck.
  const ourCharacters = deckCardNames(ourDeck, true);
  const ourFullPool = deckCardNames(ourDeck, false);
  const yourBoard = pickN(ourCharacters, 1 + Math.floor(Math.random() * 2));
  const hand = pickN(
    ourFullPool.filter((c) => !yourBoard.includes(c)),
    3 + Math.floor(Math.random() * 2),
  );
  const opponentBoard = pickN(opponentCharacterPool, 1 + Math.floor(Math.random() * 3));

  return {
    turn,
    yourLore,
    opponentLore,
    availableInk,
    yourBoard,
    opponentBoard: opponentBoard.length > 0 ? opponentBoard : ["an unrevealed threat"],
    hand,
  };
}

async function relevantObservations(teamId: string, deckId: string, opponentLabel: string) {
  // Prioritize: exact deck+opponent match > our-deck wildcard > opponent
  // wildcard > fully global. matchupKey convention: "<deckId>:<opponentLabel>",
  // "*:<opponentLabel>", or "*:*" (see src/db/seed.ts).
  const rows = await db
    .select()
    .from(aiObservations)
    .where(
      eq(aiObservations.teamId, teamId),
    )
    .orderBy(desc(aiObservations.confidence))
    .limit(50);

  const exact = rows.filter((r) => r.matchupKey === `${deckId}:${opponentLabel}`);
  const deckWildcard = rows.filter((r) => r.matchupKey === `*:${opponentLabel}`);
  const global = rows.filter((r) => r.matchupKey === "*:*");

  return [...exact, ...deckWildcard, ...global].slice(0, 4);
}

export type GenerateScenarioParams = {
  teamId: string;
  deckId: string;
  opponentLabel: string;
  /** The player this scenario is being generated for, if any (personalizes matchup history framing). */
  forPlayerId?: string;
  /** Bias the AI toward testing a specific weak category (used by the adaptive loop / /coach). */
  targetCategory?: (typeof CATEGORY_VALUES)[number];
};

export async function generateMatchupScenario(params: GenerateScenarioParams) {
  const [ourDeck] = await db.select().from(decks).where(eq(decks.id, params.deckId)).limit(1);
  if (!ourDeck) throw new Error(`Deck ${params.deckId} not found`);

  const [opponentDeck] = await db
    .select()
    .from(decks)
    .where(
      or(eq(decks.name, params.opponentLabel), ilike(decks.name, `${params.opponentLabel}%`)),
    )
    .limit(1);

  const opponentPool = opponentDeck ? deckCardNames(opponentDeck, true) : [];
  const situation = buildBoardState(ourDeck, opponentPool);
  const observations = await relevantObservations(params.teamId, params.deckId, params.opponentLabel);

  const system = `You are the Scenario Generator agent for a competitive Disney Lorcana team's private practice tool.
Your job: given a concrete board state, write a multiple-choice practice decision and its coaching explanation.

Rules:
- You are NOT a rules authority. Never state official card text or rules as fact - reason only about strategy.
- Ground "teamLearning" in the team's own historical observations if any are provided below. If none are provided, give sound general strategic reasoning instead and do NOT invent statistics or fabricate a number of past games.
- Keep it concrete and specific to the given board state, not generic advice.
- Exactly one of the four options should be the strategically strongest play.`;

  const user = JSON.stringify({
    matchup: { yourDeck: ourDeck.name, opponentDeck: params.opponentLabel },
    boardState: situation,
    targetCategoryHint: params.targetCategory ?? null,
    teamHistoricalObservations: observations.map((o) => ({
      category: o.category,
      confidence: o.confidence,
      observation: o.observation,
    })),
  });

  const { data } = await completeTaskStructured<ScenarioContent>("scenario_generation", {
    system,
    messages: [{ role: "user", content: user }],
    toolName: "emit_practice_scenario",
    toolDescription: "Return the practice scenario's multiple-choice content and coaching explanation.",
    schema: SCENARIO_CONTENT_SCHEMA,
    maxTokens: 1400,
  });

  const question = `Turn ${situation.turn} - Your Decision. You have ${situation.availableInk} available ink. What is your play?`;
  const options: { key: "A" | "B" | "C" | "D"; label: string }[] = (
    ["A", "B", "C", "D"] as const
  ).map((key) => ({ key, label: data.options[key] }));

  const [row] = await db
    .insert(practiceScenarios)
    .values({
      teamId: params.teamId,
      kind: "matchup",
      deckId: ourDeck.id,
      opponentDeckLabel: params.opponentLabel,
      matchupKey: `${ourDeck.id}:${params.opponentLabel}`,
      situation,
      question,
      options,
      correctAnswer: data.correctAnswer,
      aiExplanation: data.explanation,
      teamLearning: data.teamLearning,
      alternativeLine: data.alternativeLine,
      coachNote: data.coachNote,
      category: data.category,
      difficulty: 2,
      sourceType: observations.length > 0 ? "historical" : "generic",
      generatedForPlayerId: params.forPlayerId,
      targetWeaknessCategory: params.targetCategory,
    })
    .returning();

  return row;
}
