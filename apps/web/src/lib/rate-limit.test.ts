// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { resetLimits, withinLimit } from "./rate-limit";

describe("withinLimit", () => {
  beforeEach(resetLimits);

  it("passes the allowance and refuses the rest", () => {
    const now = 1_000_000;
    expect([1, 2, 3].map(() => withinLimit("a", 3, 60_000, now))).toEqual([true, true, true]);
    expect(withinLimit("a", 3, 60_000, now)).toBe(false);
  });

  // Отказ не вечен: иначе один перебор запирал бы адрес до перезапуска инстанса.
  it("forgets hits that fell out of the window", () => {
    const now = 1_000_000;
    withinLimit("a", 1, 60_000, now);
    expect(withinLimit("a", 1, 60_000, now + 59_000)).toBe(false);
    expect(withinLimit("a", 1, 60_000, now + 61_000)).toBe(true);
  });

  it("counts keys apart", () => {
    const now = 1_000_000;
    withinLimit("a", 1, 60_000, now);
    expect(withinLimit("a", 1, 60_000, now)).toBe(false);
    expect(withinLimit("b", 1, 60_000, now)).toBe(true);
  });
});
