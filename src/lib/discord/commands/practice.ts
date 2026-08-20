import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { generateMatchupScenario, type PracticeCategory } from "@/lib/agents/scenarioGenerator";
import { resolvePlayerContext } from "../context";
import type { DiscordInteraction } from "../types";
import {
  messageResponse,
  updateMessageResponse,
  deferredUpdateResponse,
  actionRow,
  button,
  stringSelect,
  BRAND_COLOR,
  SUCCESS_COLOR,
  WARN_COLOR,
  ButtonStyleTypes,
  type Embed,
} from "../ui";
import { editOriginalInteractionResponse } from "../rest";
import type { RouteResult } from "../router";

const { decks, practiceScenarios, scenarioAttempts } = schema;

// ---------------------------------------------------------------------------
// /practice - top-level menu
// ---------------------------------------------------------------------------

export async function handlePracticeCommand(_interaction: DiscordInteraction): Promise<RouteResult> {
  const embed: Embed = {
    title: "Lorcana Competitive Practice",
    color: BRAND_COLOR,
    description: "Choose what you want to practice.",
  };

  const components = [
    actionRow([
      button("practice:top:matchup", "Matchup Practice", ButtonStyleTypes.PRIMARY),
      button("practice:top:random", "Random Scenario"),
      button("practice:top:mulligan", "Mulligan Test"),
    ]),
    actionRow([
      button("practice:top:decision", "Decision Test"),
      button("practice:top:analyze", "Analyze Recent Games"),
      button("practice:top:weakness", "Practice Weakness"),
    ]),
  ];

  return { immediate: messageResponse(undefined, [embed], components) };
}

// ---------------------------------------------------------------------------
// Component routing (buttons / selects within the /practice flow)
// ---------------------------------------------------------------------------

export async function handlePracticeComponent(interaction: DiscordInteraction): Promise<RouteResult> {
  const customId = interaction.data?.custom_id ?? "";
  const parts = customId.split(":");
  const step = parts[1];

  switch (step) {
    case "top":
      return handleTopChoice(interaction, parts[2]);
    case "deck":
      return handleDeckSelected(interaction);
    case "opponent":
      // custom_id shape: "practice:opponent:select:<deckId>" - parts[2] is
      // the literal "select" action tag, parts[3] is the actual deck id.
      return handleOpponentSelected(interaction, parts[3]);
    case "type":
      return handlePracticeTypeChosen(interaction, parts[2], parts[3], parts.slice(4).join(":"));
    case "answer":
      return handleAnswer(interaction, parts[2], parts[3] as "A" | "B" | "C" | "D");
    case "different":
      return handleDifferentLine(interaction, parts[2]);
    case "again": {
      // custom_id shape: "practice:again:<deckId>:<category-or-none>:<opponentLabel>".
      // Also reused directly by /coach's "Practice X" buttons to jump
      // straight into a scenario without the deck/opponent picker.
      const deckId = parts[2];
      const bias = parts[3];
      const opponentLabel = parts.slice(4).join(":");
      const targetCategory = bias && bias !== "none" ? (bias as PracticeCategory) : undefined;
      return handlePracticeTypeChosen(interaction, "scenario", deckId, opponentLabel, targetCategory);
    }
    default:
      return { immediate: updateMessageResponse("This practice flow isn't available yet.") };
  }
}

async function handleTopChoice(interaction: DiscordInteraction, choice: string): Promise<RouteResult> {
  if (choice !== "matchup" && choice !== "random") {
    return {
      immediate: updateMessageResponse(undefined, [
        {
          title: "Coming soon",
          color: WARN_COLOR,
          description:
            "This practice mode isn't built yet. Try **Matchup Practice** - full matchup-grounded scenarios are live.",
        },
      ]),
    };
  }

  const { team } = await resolvePlayerContext(interaction);
  const ourDecks = await db
    .select()
    .from(decks)
    .where(and(eq(decks.teamId, team.id), eq(decks.isOpponentArchetype, false)));

  if (ourDecks.length === 0) {
    return {
      immediate: updateMessageResponse(
        "Your team doesn't have any decks recorded yet. Add one via the dashboard first.",
      ),
    };
  }

  return {
    immediate: updateMessageResponse(
      undefined,
      [{ title: "Choose your deck", color: BRAND_COLOR }],
      [
        actionRow([
          stringSelect(
            "practice:deck:select",
            "Choose your deck",
            ourDecks.map((d) => ({
              label: `${d.name} (${d.version})`,
              value: d.id,
              description: d.inkColors.join("/"),
            })),
          ),
        ]),
      ],
    ),
  };
}

async function handleDeckSelected(interaction: DiscordInteraction): Promise<RouteResult> {
  const deckId = interaction.data?.values?.[0];
  if (!deckId) return { immediate: updateMessageResponse("No deck selected - try `/practice` again.") };

  const { team } = await resolvePlayerContext(interaction);
  const opponentDecks = await db
    .select()
    .from(decks)
    .where(and(eq(decks.teamId, team.id), eq(decks.isOpponentArchetype, true)));

  if (opponentDecks.length === 0) {
    return {
      immediate: updateMessageResponse(
        "No opponent archetypes recorded yet for your team. Add one via the dashboard first.",
      ),
    };
  }

  return {
    immediate: updateMessageResponse(
      undefined,
      [{ title: "Choose opponent deck", color: BRAND_COLOR }],
      [
        actionRow([
          stringSelect(
            `practice:opponent:select:${deckId}`,
            "Choose opponent deck",
            opponentDecks.map((d) => ({
              label: d.name,
              value: d.id,
              description: d.inkColors.join("/"),
            })),
          ),
        ]),
      ],
    ),
  };
}

async function handleOpponentSelected(interaction: DiscordInteraction, deckId: string): Promise<RouteResult> {
  const opponentDeckId = interaction.data?.values?.[0];
  if (!opponentDeckId) return { immediate: updateMessageResponse("No opponent selected - try `/practice` again.") };

  const [opponentDeck] = await db.select().from(decks).where(eq(decks.id, opponentDeckId)).limit(1);
  if (!opponentDeck) return { immediate: updateMessageResponse("That opponent deck couldn't be found.") };

  const opponentLabel = opponentDeck.inkColors.join("/");

  return {
    immediate: updateMessageResponse(
      undefined,
      [
        {
          title: "Practice type",
          color: BRAND_COLOR,
          description: `Your deck vs **${opponentDeck.name}**`,
        },
      ],
      [
        actionRow([
          button(`practice:type:scenario:${deckId}:${opponentLabel}`, "Scenario Practice", ButtonStyleTypes.PRIMARY),
          button(`practice:type:guide:${deckId}:${opponentLabel}`, "Full Matchup Guide"),
        ]),
        actionRow([
          button(`practice:type:mulligan:${deckId}:${opponentLabel}`, "Mulligan Practice"),
          button(`practice:type:decision:${deckId}:${opponentLabel}`, "Decision Practice"),
          button(`practice:type:random:${deckId}:${opponentLabel}`, "Random"),
        ]),
      ],
    ),
  };
}

async function handlePracticeTypeChosen(
  interaction: DiscordInteraction,
  kind: string,
  deckId: string,
  opponentLabel: string,
  targetCategory?: PracticeCategory,
): Promise<RouteResult> {
  if (kind !== "scenario" && kind !== "random") {
    return {
      immediate: updateMessageResponse(undefined, [
        {
          title: "Coming soon",
          color: WARN_COLOR,
          description: "This practice type isn't built yet. Scenario Practice is live - try that one.",
        },
      ]),
    };
  }

  // Scenario generation calls the AI and can take a few seconds - ack now,
  // finish the real work in `after()`, then edit the message in place.
  return {
    immediate: deferredUpdateResponse(),
    deferred: () => runScenarioGeneration(interaction, deckId, opponentLabel, targetCategory),
  };
}

async function runScenarioGeneration(
  interaction: DiscordInteraction,
  deckId: string,
  opponentLabel: string,
  targetCategory?: PracticeCategory,
) {
  const { team, player } = await resolvePlayerContext(interaction);

  let scenario;
  try {
    scenario = await generateMatchupScenario({
      teamId: team.id,
      deckId,
      opponentLabel,
      forPlayerId: player.id,
      targetCategory,
    });
  } catch (err) {
    console.error("Scenario generation failed:", err);
    await editOriginalInteractionResponse(interaction.application_id, interaction.token, {
      embeds: [
        {
          title: "Couldn't generate a scenario",
          color: WARN_COLOR,
          description: "Something went wrong talking to the AI coach. Please try again in a moment.",
        },
      ],
      components: [],
    });
    return;
  }

  const situation = scenario.situation;
  const embed: Embed = {
    title: `Turn ${situation.turn} - Your Decision`,
    color: BRAND_COLOR,
    description: scenario.question,
    fields: [
      { name: "Your lore", value: `${situation.yourLore}`, inline: true },
      { name: "Opponent lore", value: `${situation.opponentLore}`, inline: true },
      { name: "Available ink", value: `${situation.availableInk}`, inline: true },
      { name: "Your board", value: situation.yourBoard.join("\n") || "(empty)", inline: false },
      { name: "Opponent board", value: situation.opponentBoard.join("\n") || "(empty)", inline: false },
      { name: "Hand", value: situation.hand.join("\n") || "(empty)", inline: false },
    ],
    footer: { text: `vs ${opponentLabel}` },
  };

  const optionButtons = (scenario.options as { key: string; label: string }[]).map((o) =>
    button(`practice:answer:${scenario.id}:${o.key}`, `${o.key}. ${o.label}`.slice(0, 80)),
  );

  await editOriginalInteractionResponse(interaction.application_id, interaction.token, {
    embeds: [embed],
    components: [
      actionRow(optionButtons),
      actionRow([button(`practice:different:${scenario.id}`, "Different Line", ButtonStyleTypes.SECONDARY)]),
    ],
  });
}

async function handleAnswer(
  interaction: DiscordInteraction,
  scenarioId: string,
  chosen: "A" | "B" | "C" | "D",
): Promise<RouteResult> {
  const [scenario] = await db
    .select()
    .from(practiceScenarios)
    .where(eq(practiceScenarios.id, scenarioId))
    .limit(1);

  if (!scenario) {
    return { immediate: updateMessageResponse("This scenario has expired - run `/practice` again.") };
  }

  const { player } = await resolvePlayerContext(interaction);
  const correct = chosen === scenario.correctAnswer;

  await db.insert(scenarioAttempts).values({
    scenarioId: scenario.id,
    playerId: player.id,
    chosenAnswer: chosen,
    correct,
    aiEvaluation: scenario.aiExplanation,
    category: scenario.category,
  });

  const options = scenario.options as { key: string; label: string }[];
  const chosenLabel = options.find((o) => o.key === chosen)?.label ?? chosen;
  const correctLabel = options.find((o) => o.key === scenario.correctAnswer)?.label ?? scenario.correctAnswer;

  const fields: Embed["fields"] = [
    { name: "Why", value: scenario.aiExplanation },
  ];
  if (scenario.teamLearning) {
    fields.push({ name: "What the team has learned", value: scenario.teamLearning });
  }
  if (scenario.alternativeLine) {
    fields.push({ name: "Alternative line", value: scenario.alternativeLine });
  }
  if (scenario.coachNote) {
    fields.push({ name: "Coach's Note", value: scenario.coachNote });
  }

  const embed: Embed = {
    title: correct ? "Result: Strong Play" : "Result: Let's Look Closer",
    color: correct ? SUCCESS_COLOR : WARN_COLOR,
    description: correct
      ? `You chose **${chosen}. ${chosenLabel}** - that was the strongest line.`
      : `You chose **${chosen}. ${chosenLabel}**. The stronger line was **${scenario.correctAnswer}. ${correctLabel}**.`,
    fields,
  };

  // Adaptive loop: a miss biases the next scenario toward the category the
  // player just got wrong; a correct answer doesn't force any particular
  // category on the next one.
  const biasSegment = correct ? "none" : scenario.category;

  return {
    immediate: updateMessageResponse(undefined, [embed], [
      actionRow([
        button(
          `practice:again:${scenario.deckId}:${biasSegment}:${scenario.opponentDeckLabel}`,
          "Next Scenario",
          ButtonStyleTypes.PRIMARY,
        ),
      ]),
    ]),
  };
}

async function handleDifferentLine(interaction: DiscordInteraction, scenarioId: string): Promise<RouteResult> {
  const [scenario] = await db
    .select()
    .from(practiceScenarios)
    .where(eq(practiceScenarios.id, scenarioId))
    .limit(1);
  if (!scenario) {
    return { immediate: updateMessageResponse("This scenario has expired - run `/practice` again.") };
  }

  const options = scenario.options as { key: string; label: string }[];
  const correctLabel = options.find((o) => o.key === scenario.correctAnswer)?.label ?? scenario.correctAnswer;

  return {
    immediate: messageResponse(
      undefined,
      [
        {
          title: "Considering a different line",
          color: BRAND_COLOR,
          description:
            "Free-text line evaluation is on the roadmap - for now, here's the strongest line the coach found:",
          fields: [
            { name: `${scenario.correctAnswer}. ${correctLabel}`, value: scenario.aiExplanation },
          ],
        },
      ],
      [],
      true,
    ),
  };
}
