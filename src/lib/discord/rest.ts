/**
 * Thin wrapper around the Discord REST API (v10).
 *
 * Two auth modes are used deliberately:
 *  - Bot token (`Authorization: Bot <token>`) for anything the app does
 *    proactively: registering slash commands, posting to a channel via
 *    webhook, looking up guild info.
 *  - Interaction token (no bot auth needed) for responding to a specific
 *    interaction: editing the deferred reply, sending follow-up messages.
 *    These are the `/webhooks/{application_id}/{interaction_token}/...`
 *    endpoints - Discord authorizes them via the token itself.
 */
const DISCORD_API_BASE = "https://discord.com/api/v10";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Check your .env / deployment env vars.`);
  }
  return value;
}

export async function discordBotFetch(path: string, init: RequestInit = {}) {
  const token = requireEnv("DISCORD_BOT_TOKEN");
  const res = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord API ${init.method ?? "GET"} ${path} -> ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Edits the original deferred interaction reply. Use from `after()` background work. */
export async function editOriginalInteractionResponse(
  applicationId: string,
  interactionToken: string,
  body: unknown,
) {
  const res = await fetch(
    `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to edit original interaction response: ${res.status} ${text}`);
  }
  return res.json();
}

/** Sends a new follow-up message tied to the interaction (e.g. a second embed). */
export async function createFollowupMessage(
  applicationId: string,
  interactionToken: string,
  body: unknown,
) {
  const res = await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to create follow-up message: ${res.status} ${text}`);
  }
  return res.json();
}

/** Registers (overwrites) global slash commands. Propagates in up to ~1 hour. */
export async function registerGlobalCommands(applicationId: string, commands: unknown[]) {
  return discordBotFetch(`/applications/${applicationId}/commands`, {
    method: "PUT",
    body: JSON.stringify(commands),
  });
}

/** Registers (overwrites) guild-scoped commands. Propagates instantly - best for dev. */
export async function registerGuildCommands(
  applicationId: string,
  guildId: string,
  commands: unknown[],
) {
  return discordBotFetch(`/applications/${applicationId}/guilds/${guildId}/commands`, {
    method: "PUT",
    body: JSON.stringify(commands),
  });
}
