import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionSecret, validateServerConfig } from "./config";
afterEach(() => vi.unstubAllEnvs());
describe("server configuration", () => {
  it("refuses a missing or known default signing key", () => {
    for (const key of ["", "short", "development-only-change-me-32-bytes"]) {
      vi.stubEnv("SESSION_SECRET", key);
      expect(sessionSecret).toThrow("SESSION_SECRET");
    }
  });
  it("refuses to run production with a transient in-memory database", () => {
    vi.stubEnv("SESSION_SECRET", "test-explicit-long-secret-for-config-check");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    expect(validateServerConfig).toThrow("DATABASE_URL");
  });
});
