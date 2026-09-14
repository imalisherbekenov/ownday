// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
const transaction = vi.hoisted(() => vi.fn());
vi.mock("@ownday/db", () => ({
  PrismaClient: class {
    $transaction = transaction;
  },
}));
import { GET } from "./route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("does not touch the database without the separate operations token", async () => {
  vi.stubEnv("OPS_HEALTH_TOKEN", "a".repeat(40));
  vi.stubEnv("DATABASE_URL", "test");
  const response = await GET(new Request("http://localhost/api/health"));
  expect(response.status).toBe(401);
  expect(transaction).not.toHaveBeenCalled();
});
it("returns unavailable without leaking a database exception", async () => {
  vi.stubEnv("OPS_HEALTH_TOKEN", "a".repeat(40));
  vi.stubEnv("DATABASE_URL", "test");
  transaction.mockRejectedValue(new Error("private database URL"));
  const response = await GET(
    new Request("http://localhost/api/health", {
      headers: { authorization: `Bearer ${"a".repeat(40)}` },
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).toBe('{"status":"unavailable"}');
  expect(response.headers.get("cache-control")).toBe("no-store");
});
