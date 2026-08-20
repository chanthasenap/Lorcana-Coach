import { timingSafeEqual } from "crypto";

/**
 * Simple shared-secret check for the one-time /api/admin/* setup routes.
 * These exist because the sandbox this app was built in cannot reach the
 * production database or Discord's API directly - so setup steps that
 * would normally be CLI commands are exposed as protected URLs the
 * deployer visits once instead.
 */
export function isAuthorizedAdminRequest(request: Request): boolean {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret) return false;

  const provided = new URL(request.url).searchParams.get("secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
