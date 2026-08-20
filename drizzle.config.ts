import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://lorcana:lorcana_dev_pw@localhost:5432/lorcana_coach",
  },
  verbose: true,
  strict: true,
});
