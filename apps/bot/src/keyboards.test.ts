import { afterEach, describe, expect, it, vi } from "vitest";
import { mainMenu } from "./keyboards.js";

describe("main menu", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("adds APP_URL to the production keyboard path without replacing existing buttons", () => {
    vi.stubEnv("APP_URL", "https://example.test/app");
    const keyboard = mainMenu("en");

    expect(keyboard.keyboard).toEqual([
      [{ text: "Today" }, { text: "New habit" }],
      [{ text: "Habits" }, { text: "Statistics" }],
      [{ text: "Settings" }],
      [{ text: "Open app", web_app: { url: "https://example.test/app" } }],
    ]);
  });

  it.each(["", "not a URL", "http://localhost:3000"])(
    "keeps the previous layout when APP_URL is %j",
    (appUrl) => {
      vi.stubEnv("APP_URL", appUrl);
      expect(mainMenu("en").keyboard).toEqual([
        [{ text: "Today" }, { text: "New habit" }],
        [{ text: "Habits" }, { text: "Statistics" }],
        [{ text: "Settings" }],
      ]);
    },
  );
});
