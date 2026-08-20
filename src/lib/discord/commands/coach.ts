import { buildCoachPriorities } from "@/lib/agents/coachAgent";
import { resolvePlayerContext } from "../context";
import type { DiscordInteraction } from "../types";
import { messageResponse, updateMessageResponse, actionRow, button, BRAND_COLOR, ButtonStyleTypes } from "../ui";
import type { RouteResult } from "../router";

export async function handleCoachCommand(interaction: DiscordInteraction): Promise<RouteResult> {
  const { team, player } = await resolvePlayerContext(interaction);
  const priorities = await buildCoachPriorities(team.id, player.id);

  if (priorities.length === 0) {
    return {
      immediate: messageResponse(undefined, [
        {
          title: "Coach",
          color: BRAND_COLOR,
          description:
            "Not enough recorded games or practice attempts yet to build a training plan. Run `/practice` or `/record` a few games and check back.",
        },
      ]),
    };
  }

  const description = priorities
    .map((p, i) => `**${i + 1}. ${p.label}**\n${p.detail}`)
    .join("\n\n");

  const buttons = priorities.map((p) =>
    button(
      `practice:again:${p.deckId}:${p.category ?? "none"}:${p.opponentLabel}`,
      p.buttonLabel.slice(0, 80),
      ButtonStyleTypes.PRIMARY,
    ),
  );

  return {
    immediate: messageResponse(
      undefined,
      [
        {
          title: "Your Current Training Priorities",
          color: BRAND_COLOR,
          description,
        },
      ],
      [actionRow(buttons)],
    ),
  };
}

export async function handleCoachComponent(_interaction: DiscordInteraction): Promise<RouteResult> {
  return { immediate: updateMessageResponse("This flow isn't built yet - check back soon.") };
}
