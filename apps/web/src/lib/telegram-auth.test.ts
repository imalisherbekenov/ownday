import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateTelegramInitData } from "./telegram-auth";
const token = "123456:test-token",
  now = new Date("2026-08-22T12:00:00Z");
function signed(overrides: Record<string, string> = {}) {
  const p = new URLSearchParams({
    auth_date: String(now.getTime() / 1000),
    query_id: "q",
    user: JSON.stringify({ id: 42, first_name: "Mira" }),
    ...overrides,
  });
  const check = [...p.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
    key = createHmac("sha256", "WebAppData").update(token).digest(),
    hash = createHmac("sha256", key).update(check).digest("hex");
  p.set("hash", hash);
  return p.toString();
}
describe("validateTelegramInitData", () => {
  it("accepts a valid signature", () =>
    expect(validateTelegramInitData(signed(), token, now).id).toBe(42));
  it("rejects tampering", () =>
    expect(() => validateTelegramInitData(signed().replace("Mira", "Nora"), token, now)).toThrow(
      "INVALID",
    ));
  it("rejects an expired timestamp", () =>
    expect(() => validateTelegramInitData(signed({ auth_date: "1700000000" }), token, now)).toThrow(
      "EXPIRED",
    ));
});
