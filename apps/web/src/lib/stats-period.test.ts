import { describe, expect, it } from "vitest";
import { readStatsPeriod } from "./stats-period";
describe("readStatsPeriod", () => {
  it.each([
    ["week", "week"],
    ["month", "month"],
    ["year", "year"],
    [undefined, "month"],
    ["bad", "month"],
  ] as const)("maps %s to %s", (input, expected) => expect(readStatsPeriod(input)).toBe(expected));
});
