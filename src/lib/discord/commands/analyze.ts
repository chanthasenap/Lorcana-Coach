import type { DiscordInteraction } from "../types";
import { messageResponse, BRAND_COLOR } from "../ui";
import type { RouteResult } from "../router";

// Full implementation (MatchupAnalyst / PatternDetectionAgent) is a post-
// vertical-slice milestone - stubbed here so the command is registered and
// discoverable from day one.

export async function handleAnalyzeCommand(_interaction: DiscordInteraction): Promise<RouteResult> {
  return {
    immediate: messageResponse(undefined, [
      {
        title: "Analyze",
        color: BRAND_COLOR,
        description: "Game and matchup analysis is coming in a later milestone.",
      },
    ]),
  };
}
