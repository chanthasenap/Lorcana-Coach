/**
 * Registers the bot's slash commands with Discord.
 *
 * - If DISCORD_DEV_GUILD_ID is set, commands are registered to that one
 *   server only, and show up instantly - use this while developing.
 * - Otherwise commands are registered globally, which can take up to ~1
 *   hour to propagate to all servers - use this for production.
 *
 * Run with: npm run discord:register
 */
import "dotenv/config";
import { commandDefinitions } from "../src/lib/discord/commands/registry";
import { registerGlobalCommands, registerGuildCommands } from "../src/lib/discord/rest";

async function main() {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  if (!applicationId) {
    throw new Error("DISCORD_APPLICATION_ID is not set in .env");
  }
  const guildId = process.env.DISCORD_DEV_GUILD_ID;

  if (guildId) {
    console.log(`Registering ${commandDefinitions.length} commands to guild ${guildId} (instant)...`);
    await registerGuildCommands(applicationId, guildId, [...commandDefinitions]);
  } else {
    console.log(`Registering ${commandDefinitions.length} commands globally (up to ~1hr to propagate)...`);
    await registerGlobalCommands(applicationId, [...commandDefinitions]);
  }

  console.log("Done:", commandDefinitions.map((c) => `/${c.name}`).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
