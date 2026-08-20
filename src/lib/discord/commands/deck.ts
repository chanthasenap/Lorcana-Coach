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
  BRAND_COLOR,
  SUCCESS_COLOR,
  WARN_COLOR,
  ButtonStyleTypes,
} from "../ui";
import type { RouteResult } from "../router";

const { decks } = schema;

// ---------------------------------------------------------------------------
// /deck - import a deck from a pasted decklist (e.g. exported from a
// deckbuilder like Dreamborn) rather than requiring manual DB/dashboard
// entry. Card TYPE is guessed from naming convention only ("Name -
// Subtitle" => Character, otherwise Action) - this is an unverified
// heuristic, not confirmed card data, and the confirmation message says so
// explicitly per the app's rule against presenting AI/heuristic guesses as
// verified facts. Ink colors and the card names themselves come straight
// from what the player typed, not from any external site.
// ---------------------------------------------------------------------------

type DeckKind = "own" | "opponent";

export async function handleDeckCommand(_interaction: DiscordInteraction): Promise<RouteResult> {
  return {
    immediate: messageResponse(
      undefined,
      [
        {
          title: "Import a Deck",
          color: BRAND_COLOR,
          description:
            "Paste a decklist (one card per line, e.g. `4 Elsa - Snow Queen`) from your own notes or exported from a deckbuilder. Is this your own deck, or an opponent archetype you're logging for the team?",
        },
      ],
      [
        actionRow([
          button("deck:import:own", "My Deck", ButtonStyleTypes.PRIMARY),
          button("deck:import:opponent", "Opponent Deck", ButtonStyleTypes.SECONDARY),
        ]),
      ],
    ),
  };
}

export async function handleDeckComponent(interaction: DiscordInteraction): Promise<RouteResult> {
  const customId = interaction.data?.custom_id ?? "";
  const parts = customId.split(":");
  const step = parts[1];

  if (step === "import") {
    const kind = parts[2] as DeckKind;
    return {
      immediate: modalResponse(`deck:importmodal:${kind}`, "Import a Deck", [
        {
          customId: "deck_name",
          label: "Deck name",
          style: 1,
          placeholder: "e.g. Amber/Steel Aggro",
          required: true,
        },
        {
          customId: "ink_colors",
          label: "Ink colors (e.g. Amber/Steel)",
          style: 1,
          placeholder: "Amber/Steel",
          required: true,
        },
        {
          customId: "decklist",
          label: "Decklist - one card per line",
          style: 2,
          placeholder: "4 Elsa - Snow Queen\n4 Mickey Mouse - Brave Little Tailor\n2 Be Prepared\n...",
          required: true,
        },
      ]),
    };
  }

  return { immediate: updateMessageResponse("This flow isn't built yet - check back soon.") };
}

export async function handleDeckModalSubmit(interaction: DiscordInteraction): Promise<RouteResult> {
  const customId = interaction.data?.custom_id ?? "";
  const [, , kindRaw] = customId.split(":");
  const kind: DeckKind = kindRaw === "opponent" ? "opponent" : "own";

  const values = getModalValues(interaction);
  const name = (values["deck_name"] ?? "").trim();
  const inkColors = (values["ink_colors"] ?? "")
    .split(/[/,]/)
    .map((c) => c.trim())
    .filter(Boolean);
  const rawDecklist = values["decklist"] ?? "";

  const { parsed, skipped } = parseDecklist(rawDecklist);

  if (!name || inkColors.length === 0 || parsed.length === 0) {
    return {
      immediate: messageResponse(
        undefined,
        [
          {
            title: "Couldn't import that deck",
            color: WARN_COLOR,
            description:
              "Make sure the deck has a name, at least one ink color, and at least one recognizable decklist line (`<count> <card name>`).",
          },
        ],
        [],
        true,
      ),
    };
  }

  const { team, player } = await resolvePlayerContext(interaction);

  const [created] = await db
    .insert(decks)
    .values({
      teamId: team.id,
      name,
      inkColors,
      decklist: parsed,
      isOpponentArchetype: kind === "opponent",
      ownerPlayerId: kind === "own" ? player.id : null,
    })
    .returning();

  const totalCards = parsed.reduce((sum, c) => sum + c.count, 0);
  const skippedNote = skipped > 0 ? `\n\n(${skipped} line${skipped === 1 ? "" : "s"} couldn't be parsed and were skipped.)` : "";

  return {
    immediate: messageResponse(
      undefined,
      [
        {
          title: "Deck imported",
          color: SUCCESS_COLOR,
          description: `**${created.name}** (${inkColors.join("/")}) - ${totalCards} cards across ${parsed.length} unique entries, saved as ${kind === "opponent" ? "an opponent archetype" : "your deck"}.\n\nCard types (Character/Action/etc.) were guessed from naming patterns, not verified against official card data - if anything looks off, it can be corrected from the dashboard.${skippedNote}`,
        },
      ],
      [],
      true,
    ),
  };
}

/** Parses lines like "4 Elsa - Snow Queen" or "4x Elsa - Snow Queen" into deck entries. */
function parseDecklist(raw: string): {
  parsed: { card: string; count: number; type?: "Character" | "Action" | "Item" | "Song" | "Location" }[];
  skipped: number;
} {
  const parsed: { card: string; count: number; type?: "Character" | "Action" | "Item" | "Song" | "Location" }[] = [];
  let skipped = 0;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (!match) {
      skipped += 1;
      continue;
    }

    const count = parseInt(match[1], 10);
    const card = match[2].trim();
    if (!count || !card) {
      skipped += 1;
      continue;
    }

    // Same unverified naming heuristic used for seed data: "Name - Subtitle"
    // reads as a Character card, anything else defaults to Action. This is
    // a guess, not a lookup against real card data - see the module note.
    const type = card.includes(" - ") ? "Character" : "Action";
    parsed.push({ card, count, type });
  }

  return { parsed, skipped };
}

