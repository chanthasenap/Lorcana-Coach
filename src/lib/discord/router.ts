import { InteractionType } from "discord-interactions";
import type { DiscordInteraction } from "./types";
import { messageResponse } from "./ui";
import { handleHelp } from "./commands/help";
import { handlePracticeCommand, handlePracticeComponent } from "./commands/practice";
import { handleCoachCommand, handleCoachComponent } from "./commands/coach";
import { handleRecordCommand, handleRecordComponent, handleRecordModalSubmit } from "./commands/record";
import { handleAnalyzeCommand } from "./commands/analyze";
import { handleDeckCommand, handleDeckComponent, handleDeckModalSubmit } from "./commands/deck";

export type RouteResult = {
  /** Sent synchronously as the interaction response (must happen within Discord's ~3s window). */
  immediate: Record<string, unknown>;
  /** Optional slow work (AI calls, DB writes) run via `after()`, followed by editing the response. */
  deferred?: () => Promise<void>;
};

/**
 * Dispatches a verified Discord interaction to the right command/component
 * handler. Slash commands are routed by `data.name`; buttons/selects/modals
 * are routed by a `custom_id` prefix convention: `"<command>:<step>:<...args>"`,
 * e.g. `practice:deck:select`, `record:notable:misplay`.
 */
export async function routeInteraction(interaction: DiscordInteraction): Promise<RouteResult> {
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const name = interaction.data?.name;
    switch (name) {
      case "practice":
        return handlePracticeCommand(interaction);
      case "coach":
        return handleCoachCommand(interaction);
      case "record":
        return handleRecordCommand(interaction);
      case "analyze":
        return handleAnalyzeCommand(interaction);
      case "deck":
        return handleDeckCommand(interaction);
      case "help":
        return handleHelp(interaction);
      default:
        return { immediate: messageResponse(`Unknown command: /${name}`, [], [], true) };
    }
  }

  if (
    interaction.type === InteractionType.MESSAGE_COMPONENT ||
    interaction.type === InteractionType.MODAL_SUBMIT
  ) {
    const customId = interaction.data?.custom_id ?? "";
    const [namespace] = customId.split(":");

    if (interaction.type === InteractionType.MODAL_SUBMIT && namespace === "record") {
      return handleRecordModalSubmit(interaction);
    }
    if (interaction.type === InteractionType.MODAL_SUBMIT && namespace === "deck") {
      return handleDeckModalSubmit(interaction);
    }

    switch (namespace) {
      case "practice":
        return handlePracticeComponent(interaction);
      case "coach":
        return handleCoachComponent(interaction);
      case "record":
        return handleRecordComponent(interaction);
      case "deck":
        return handleDeckComponent(interaction);
      default:
        return { immediate: messageResponse("This button/menu is no longer valid.", [], [], true) };
    }
  }

  return { immediate: messageResponse("Unsupported interaction type.", [], [], true) };
}
