import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./session", () => ({ readSession: vi.fn(async () => null) }));

describe("getCurrentUserId", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, "postgresql://user:password@localhost:5432/ownday"])(
    "requires authentication in production when DATABASE_URL is %s",
    async (databaseUrl) => {
      vi.stubEnv("DATABASE_URL", databaseUrl);

      const { getCurrentUserId } = await import("./services");
      await expect(getCurrentUserId()).rejects.toThrow("AUTH_REQUIRED");
    },
  );
});
