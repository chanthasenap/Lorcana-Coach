import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAuthorizedAdminRequest } from "./auth";

describe("isAuthorizedAdminRequest", () => {
  const ORIGINAL_SECRET = process.env.ADMIN_SETUP_SECRET;

  beforeEach(() => {
    process.env.ADMIN_SETUP_SECRET = "test-shared-secret-value";
  });

  afterEach(() => {
    process.env.ADMIN_SETUP_SECRET = ORIGINAL_SECRET;
  });

  function requestWithSecret(secret: string | null): Request {
    const url = new URL("https://example.com/api/admin/migrate");
    if (secret !== null) url.searchParams.set("secret", secret);
    return new Request(url);
  }

  it("authorizes a request whose ?secret matches ADMIN_SETUP_SECRET exactly", () => {
    expect(isAuthorizedAdminRequest(requestWithSecret("test-shared-secret-value"))).toBe(true);
  });

  it("rejects a request with a wrong secret", () => {
    expect(isAuthorizedAdminRequest(requestWithSecret("wrong-secret"))).toBe(false);
  });

  it("rejects a request with no secret param at all", () => {
    expect(isAuthorizedAdminRequest(requestWithSecret(null))).toBe(false);
  });

  it("rejects a request with an empty secret param", () => {
    expect(isAuthorizedAdminRequest(requestWithSecret(""))).toBe(false);
  });

  it("rejects a secret that's a prefix or superstring of the real one (length mismatch)", () => {
    expect(isAuthorizedAdminRequest(requestWithSecret("test-shared-secret-val"))).toBe(false);
    expect(isAuthorizedAdminRequest(requestWithSecret("test-shared-secret-value-extra"))).toBe(false);
  });

  it("fails closed (never authorizes) when ADMIN_SETUP_SECRET isn't configured", () => {
    delete process.env.ADMIN_SETUP_SECRET;
    // Even an empty-string guess shouldn't match an unset secret.
    expect(isAuthorizedAdminRequest(requestWithSecret(""))).toBe(false);
    expect(isAuthorizedAdminRequest(requestWithSecret("anything"))).toBe(false);
  });
});
