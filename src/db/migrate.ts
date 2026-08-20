import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./index";

/**
 * Programmatic migration runner. Used two ways:
 *  - Locally: `npm run db:migrate` (drizzle-kit CLI) is the normal path.
 *  - Production: the sandbox this app was built in can't reach the
 *    production database directly, so `/api/admin/migrate` imports and
 *    calls this function at runtime instead, where the deployed app *does*
 *    have normal network access to the database.
 */
export async function runMigrations() {
  await migrate(db, { migrationsFolder: "./drizzle" });
}
