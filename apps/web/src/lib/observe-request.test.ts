// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { observeRequest } from "./observe-request";
afterEach(() => vi.restoreAllMocks());
it("correlates a response without logging its sensitive contents", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const response = await observeRequest("sync.write", async () =>
    Response.json({ title: "Private habit", token: "secret" }, { status: 409 }),
  );
  const data = JSON.parse(log.mock.calls[0]![0]);
  expect(data.status).toBe(409);
  expect(data.requestId).toBe(response.headers.get("x-request-id"));
  expect(Object.keys(data).sort()).toEqual(["at", "durationMs", "event", "requestId", "status"]);
  expect(log.mock.calls[0]![0]).not.toMatch(/Private habit|secret/);
});
it("records a failure without serializing the exception", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  await expect(
    observeRequest("auth.exchange", async () => {
      throw new Error("secret code");
    }),
  ).rejects.toThrow();
  expect(JSON.parse(log.mock.calls[0]![0]).status).toBe(500);
  expect(log.mock.calls[0]![0]).not.toContain("secret code");
});
