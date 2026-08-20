import { NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/admin/auth";
import { runMigrations } from "@/db/migrate";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await runMigrations();
    return NextResponse.json({ status: "ok", message: "Migrations applied." });
  } catch (err) {
    console.error("Migration failed:", err);
    return NextResponse.json(
      { status: "error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
