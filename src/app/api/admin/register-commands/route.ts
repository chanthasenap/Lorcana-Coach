import { NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/admin/auth";
import { commandDefinitions } from "@/lib/discord/commands/registry";
import { registerGlobalCommands, registerGuildCommands } from "@/lib/discord/rest";

export async function GET(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applicationId = process.env.DISCORD_APPLICATION_ID;
  if (!applicationId) {
    return NextResponse.json(
      { status: "error", message: "DISCORD_APPLICATION_ID is not set" },
      { status: 500 },
    );
  }

  // ?scope=global forces global registration regardless of
  // DISCORD_DEV_GUILD_ID - an explicit escape hatch for cases where guild-
  // scoped registration is stuck (e.g. Discord hasn't propagated the
  // applications.commands OAuth grant for that guild yet), so this doesn't
  // depend on correctly editing/redeploying env vars to unblock it.
  const forceGlobal = new URL(request.url).searchParams.get("scope") === "global";
  const guildId = forceGlobal ? undefined : process.env.DISCORD_DEV_GUILD_ID;
  try {
    // Capture Discord's own response (real command IDs) instead of just
    // echoing our local definitions back - proves what Discord actually
    // stored, rather than just that our PUT didn't throw.
    const discordResponse = guildId
      ? await registerGuildCommands(applicationId, guildId, [...commandDefinitions])
      : await registerGlobalCommands(applicationId, [...commandDefinitions]);

    return NextResponse.json({
      status: "ok",
      scope: guildId ? `guild:${guildId}` : "global",
      applicationId,
      discordResponse,
    });
  } catch (err) {
    console.error("Command registration failed:", err);
    return NextResponse.json(
      { status: "error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
