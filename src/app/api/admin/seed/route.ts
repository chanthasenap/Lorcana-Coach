import { NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/admin/auth";
import { seedDemoData } from "@/db/seed";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await seedDemoData();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("Seed failed:", err);
    return NextResponse.json(
      { status: "error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
