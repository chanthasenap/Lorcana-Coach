import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __lorcanaDbClient: ReturnType<typeof postgres> | undefined;
}

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure it (see README).",
    );
  }
  return url;
}

// Reuse the connection across hot reloads / serverless invocations in the same
// runtime instance rather than opening a new pool on every import.
const client =
  global.__lorcanaDbClient ??
  postgres(getConnectionString(), {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__lorcanaDbClient = client;
}

export const db = drizzle(client, { schema });
export * as schema from "./schema";
