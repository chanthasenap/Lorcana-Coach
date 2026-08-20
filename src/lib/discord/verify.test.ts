import { describe, it, expect, afterEach } from "vitest";
import nacl from "tweetnacl";
import { verifyDiscordRequest } from "./verify";

function makeRequest(body: string, signature: string, timestamp: string): Request {
  return new Request("http://localhost/api/discord/interactions", {
    method: "POST",
    headers: {
      "x-signature-ed25519": signature,
      "x-signature-timestamp": timestamp,
      "content-type": "application/json",
    },
    body,
  });
}

describe("verifyDiscordRequest", () => {
  const originalPublicKey = process.env.DISCORD_PUBLIC_KEY;

  afterEach(() => {
    process.env.DISCORD_PUBLIC_KEY = originalPublicKey;
  });

  it("accepts a validly signed request", async () => {
    const keyPair = nacl.sign.keyPair();
    process.env.DISCORD_PUBLIC_KEY = Buffer.from(keyPair.publicKey).toString("hex");

    const body = JSON.stringify({ type: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = nacl.sign.detached(Buffer.from(timestamp + body), keyPair.secretKey);
    const signatureHex = Buffer.from(sig).toString("hex");

    const { isValid, body: readBody } = await verifyDiscordRequest(
      makeRequest(body, signatureHex, timestamp),
    );

    expect(isValid).toBe(true);
    expect(readBody).toBe(body);
  });

  it("rejects a request signed with the wrong key", async () => {
    const realKeyPair = nacl.sign.keyPair();
    const impostorKeyPair = nacl.sign.keyPair();
    process.env.DISCORD_PUBLIC_KEY = Buffer.from(realKeyPair.publicKey).toString("hex");

    const body = JSON.stringify({ type: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = nacl.sign.detached(Buffer.from(timestamp + body), impostorKeyPair.secretKey);
    const signatureHex = Buffer.from(sig).toString("hex");

    const { isValid } = await verifyDiscordRequest(makeRequest(body, signatureHex, timestamp));

    expect(isValid).toBe(false);
  });

  it("rejects a request with a tampered body", async () => {
    const keyPair = nacl.sign.keyPair();
    process.env.DISCORD_PUBLIC_KEY = Buffer.from(keyPair.publicKey).toString("hex");

    const originalBody = JSON.stringify({ type: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = nacl.sign.detached(Buffer.from(timestamp + originalBody), keyPair.secretKey);
    const signatureHex = Buffer.from(sig).toString("hex");

    const tamperedBody = JSON.stringify({ type: 2, data: { name: "practice" } });
    const { isValid } = await verifyDiscordRequest(makeRequest(tamperedBody, signatureHex, timestamp));

    expect(isValid).toBe(false);
  });

  it("rejects when signature/timestamp headers are missing", async () => {
    process.env.DISCORD_PUBLIC_KEY = "aa".repeat(32);
    const req = new Request("http://localhost/api/discord/interactions", {
      method: "POST",
      body: JSON.stringify({ type: 1 }),
    });

    const { isValid } = await verifyDiscordRequest(req);
    expect(isValid).toBe(false);
  });

  it("rejects when DISCORD_PUBLIC_KEY is not configured", async () => {
    delete process.env.DISCORD_PUBLIC_KEY;
    const { isValid } = await verifyDiscordRequest(makeRequest("{}", "aa", "123"));
    expect(isValid).toBe(false);
  });
});
