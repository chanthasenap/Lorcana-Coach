import { verifyKey } from "discord-interactions";

/**
 * Verifies a raw Discord Interactions HTTP request against the app's public
 * key (Ed25519 signature over `timestamp + body`). Discord requires this
 * check on every request to the Interactions Endpoint URL - unsigned or
 * badly-signed requests must be rejected with 401 before any processing.
 *
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
 */
export async function verifyDiscordRequest(
  request: Request,
): Promise<{ isValid: boolean; body: string }> {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  const body = await request.text();

  if (!signature || !timestamp || !publicKey) {
    return { isValid: false, body };
  }

  const isValid = await verifyKey(body, signature, timestamp, publicKey);
  return { isValid, body };
}
