import { NextResponse, after } from "next/server";
import { InteractionType, InteractionResponseType } from "discord-interactions";
import { verifyDiscordRequest } from "@/lib/discord/verify";
import { routeInteraction } from "@/lib/discord/router";
import type { DiscordInteraction } from "@/lib/discord/types";

// Scenario generation / AI evaluation can run past Discord's 3s interaction
// window, so this route defers and finishes work in `after()`. Give it
// headroom on serverless (Vercel Hobby allows up to 60s per invocation).
export const maxDuration = 60;

export async function POST(request: Request) {
  const { isValid, body } = await verifyDiscordRequest(request);
  if (!isValid) {
    return new NextResponse("Bad request signature", { status: 401 });
  }

  const interaction = JSON.parse(body) as DiscordInteraction;

  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  try {
    const { immediate, deferred } = await routeInteraction(interaction);
    if (deferred) {
      after(async () => {
        try {
          await deferred();
        } catch (err) {
          console.error("Deferred interaction work failed:", err);
        }
      });
    }
    return NextResponse.json(immediate);
  } catch (err) {
    console.error("Interaction handling failed:", err);
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Something went wrong handling that. Please try again.", flags: 64 },
    });
  }
}

// Discord occasionally probes with GET while validating the endpoint URL in
// some setups; respond harmlessly rather than 404ing.
export async function GET() {
  return NextResponse.json({ status: "ok", message: "Lorcana Coach Discord interactions endpoint" });
}
