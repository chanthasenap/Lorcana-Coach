import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolvePlayerContext } from "../context";
import type { DiscordInteraction } from "../types";
import { getModalValues } from "../types";
import {
  messageResponse,
  updateMessageResponse,
  modalResponse,
  actionRow,
  button,
  stringSelect,
  BRAND_COLOR,
  SUCCESS_COLOR,
  ButtonStyleTypes,
} from "../ui";
import type { RouteResult } from "../router";

const { decks, matches, games } = schema;

const NOTABLE_TAGS = [
  { tag: "mulligan", label: "Mulligan" },
  { tag: "misplay", label: "Misplay" },
  { tag: "great_line", label: "Great Line" },
  { tag: "opponent_strategy", label: "Opponent Strategy" },
  { tag: "nothing", label: "Nothing" },
] as const;

// ---------------------------------------------------------------------------
// /record - fast match entry, mostly taps: deck -> opponent -> result ->
// play/draw -> (saved) -> "anything notable?" follow-up.
// ---------------------------------------------------------------------------

export async function handleRecordCommand(interaction: DiscordInteraction): Promise<RouteResult> {
  const { team } = await resolvePlayerContext(interaction);
  const ourDecks = await db
    .select()
    .from(decks)
    .where(and(eq(decks.teamId, team.id), eq(decks.isOpponentArchetype, false)));

  if (ourDecks.length === 0) {
    return {
      immediate: messageResponse("Your team doesn't have any decks recorded yet. Add one via the dashboard first."),
    };
  }

  return {
    immediate: messageResponse(
      undefined,
      [{ title: "Record a Match", color: BRAND_COLOR, description: "Choose your deck." }],
      [
        actionRow([
          stringSelect(
            "record:deck:select",
            "Choose your deck",
            ourDecks.map((d) => ({ label: `${d.name} (${d.version})`, value: d.id, description: d.inkColors.join("/") })),
          ),
        ]),
      ],
    ),
  };
}

export async function handleRecordComponent(interaction: DiscordInteraction): Promise<RouteResult> {
  const customId = interaction.data?.custom_id ?? "";
  const parts = customId.split(":");
  const step = parts[1];

  switch (step) {
    case "deck":
      return handleDeckSelected(interaction);
    case "opponent":
      return handleOpponentSelected(interaction, parts[3]); // parts[2] is literal "select"
    case "result":
      return handleResultChosen(interaction, parts[2], parts[3], parts[4] as "win" | "loss" | "draw");
    case "playdraw":
      return handlePlayDrawChosen(
        interaction,
        parts[2],
        parts[3],
        parts[4] as "win" | "loss" | "draw",
        parts[5] as "play" | "draw",
      );
    case "notable":
      return handleNotable(interaction, parts[2], parts[3] as (typeof NOTABLE_TAGS)[number]["tag"]);
    default:
      return { immediate: updateMessageResponse("This flow isn't built yet - check back soon.") };
  }
}

export async function handleRecordModalSubmit(interaction: DiscordInteraction): Promise<RouteResult> {
  const customId = interaction.data?.custom_id ?? "";
  const [, , matchId] = customId.split(":");
  const values = getModalValues(interaction);
  const note = values["misplay_note"] ?? "";

  await db.insert(games).values({
    matchId,
    gameNumber: 1,
    result: (await matchResult(matchId)) ?? "loss",
    noteTag: "misplay",
    noteDetail: note,
    mistakes: note ? [note] : [],
  });

  return {
    immediate: messageResponse(
      undefined,
      [{ title: "Noted", color: SUCCESS_COLOR, description: `Logged as a misplay: "${note}"` }],
      [],
      true,
    ),
  };
}

// ---------------------------------------------------------------------------

async function handleDeckSelected(interaction: DiscordInteraction): Promise<RouteResult> {
  const deckId = interaction.data?.values?.[0];
  if (!deckId) return { immediate: updateMessageResponse("No deck selected - try `/record` again.") };

  const { team } = await resolvePlayerContext(interaction);
  const opponentDecks = await db
    .select()
    .from(decks)
    .where(and(eq(decks.teamId, team.id), eq(decks.isOpponentArchetype, true)));

  if (opponentDecks.length === 0) {
    return { immediate: updateMessageResponse("No opponent archetypes recorded yet for your team.") };
  }

  return {
    immediate: updateMessageResponse(
      undefined,
      [{ title: "Opponent deck", color: BRAND_COLOR }],
      [
        actionRow([
          stringSelect(
            `record:opponent:select:${deckId}`,
            "Choose opponent deck",
            opponentDecks.map((d) => ({ label: d.name, value: d.id, description: d.inkColors.join("/") })),
          ),
        ]),
      ],
    ),
  };
}

async function handleOpponentSelected(interaction: DiscordInteraction, deckId: string): Promise<RouteResult> {
  const opponentDeckId = interaction.data?.values?.[0];
  if (!opponentDeckId) return { immediate: updateMessageResponse("No opponent selected - try `/record` again.") };

  const [opponentDeck] = await db.select().from(decks).where(eq(decks.id, opponentDeckId)).limit(1);
  if (!opponentDeck) return { immediate: updateMessageResponse("That opponent deck couldn't be found.") };
  const opponentLabel = opponentDeck.inkColors.join("/");

  return {
    immediate: updateMessageResponse(
      undefined,
      [{ title: "Result", color: BRAND_COLOR, description: `vs **${opponentDeck.name}**` }],
      [
        actionRow([
          button(`record:result:${deckId}:${opponentLabel}:win`, "Win", ButtonStyleTypes.SUCCESS),
          button(`record:result:${deckId}:${opponentLabel}:loss`, "Loss", ButtonStyleTypes.DANGER),
          button(`record:result:${deckId}:${opponentLabel}:draw`, "Draw", ButtonStyleTypes.SECONDARY),
        ]),
      ],
    ),
  };
}

async function handleResultChosen(
  interaction: DiscordInteraction,
  deckId: string,
  opponentLabel: string,
  result: "win" | "loss" | "draw",
): Promise<RouteResult> {
  return {
    immediate: updateMessageResponse(
      undefined,
      [{ title: "Play or draw?", color: BRAND_COLOR }],
      [
        actionRow([
          button(`record:playdraw:${deckId}:${opponentLabel}:${result}:play`, "Play", ButtonStyleTypes.PRIMARY),
          button(`record:playdraw:${deckId}:${opponentLabel}:${result}:draw`, "Draw", ButtonStyleTypes.PRIMARY),
        ]),
      ],
    ),
  };
}

async function handlePlayDrawChosen(
  interaction: DiscordInteraction,
  deckId: string,
  opponentLabel: string,
  result: "win" | "loss" | "draw",
  playDraw: "play" | "draw",
): Promise<RouteResult> {
  const { team, player } = await resolvePlayerContext(interaction);

  const [match] = await db
    .insert(matches)
    .values({
      teamId: team.id,
      playerId: player.id,
      deckId,
      opponentDeckLabel: opponentLabel,
      result,
      gameCount: 1,
      kind: "practice",
    })
    .returning();

  return {
    immediate: updateMessageResponse(
      undefined,
      [
        {
          title: "Match recorded",
          color: SUCCESS_COLOR,
          description: `${result.toUpperCase()} on the ${playDraw}, vs ${opponentLabel}.\n\nAnything notable?`,
        },
      ],
      [
        actionRow(
          NOTABLE_TAGS.slice(0, 3).map((t) => button(`record:notable:${match.id}:${t.tag}`, t.label)),
        ),
        actionRow(
          NOTABLE_TAGS.slice(3).map((t) => button(`record:notable:${match.id}:${t.tag}`, t.label)),
        ),
      ],
    ),
  };
}

async function handleNotable(
  interaction: DiscordInteraction,
  matchId: string,
  tag: (typeof NOTABLE_TAGS)[number]["tag"],
): Promise<RouteResult> {
  if (tag === "misplay") {
    return {
      immediate: modalResponse(`record:misplaymodal:${matchId}`, "What was the misplay?", [
        {
          customId: "misplay_note",
          label: "Briefly describe what happened",
          style: 2,
          placeholder: "e.g. Overcommitted the board into a wipe on turn 5",
          required: true,
        },
      ]),
    };
  }

  const result = await matchResult(matchId);
  await db.insert(games).values({
    matchId,
    gameNumber: 1,
    result: result ?? "loss",
    noteTag: tag,
  });

  return {
    immediate: updateMessageResponse(undefined, [
      { title: "Got it", color: SUCCESS_COLOR, description: "Logged. Run `/record` any time to log another." },
    ]),
  };
}

async function matchResult(matchId: string): Promise<"win" | "loss" | "draw" | null> {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  return match?.result ?? null;
}
