import type { DiscordInteraction } from "../types";
import { messageResponse, BRAND_COLOR } from "../ui";
import type { RouteResult } from "../router";

export async function handleHelp(_interaction: DiscordInteraction): Promise<RouteResult> {
  return {
    immediate: messageResponse(undefined, [
      {
        title: "Lorcana Competitive Practice Coach",
        color: BRAND_COLOR,
        description:
          "Practice matchups, get AI coaching grounded in your team's real match history, and track improvement over time - without leaving Discord.",
        fields: [
          {
            name: "/practice",
            value: "Start a practice session: matchup scenarios, mulligan tests, decision tests, or a scenario targeting your current weakness.",
          },
          {
            name: "/coach",
            value: "See your personalized training priorities, based on your actual results.",
          },
          {
            name: "/record",
            value: "Log a real match in a few taps - deck, opponent, result, and anything notable.",
          },
          {
            name: "/analyze",
            value: "`/analyze last [count]` or `/analyze matchup <opponent>` - AI breakdown of recent games or a specific matchup.",
          },
        ],
        footer: { text: "Every game you record makes future practice smarter." },
      },
    ]),
  };
}
