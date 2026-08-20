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

  const guildId = process.env.DISCORD_DEV_GUILD_ID;
  try {
    if (guildId) {
      await registerGuildCommands(applicationId, guildId, [...commandDefinitions]);
    } else {
      await registerGlobalCommands(applicationId, [...commandDefinitions]);
    }
    return NextResponse.json({
      status: "ok",
      scope: guildId ? `guild:${guildId}` : "global",
      commands: commandDefinitions.map((c) => c.name),
    });
  } catch (err) {
    console.error("Command registration failed:", err);
    return NextResponse.json(
      { status: "error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
