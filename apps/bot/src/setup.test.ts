import { afterEach, describe, expect, it, vi } from "vitest";
import { publishBotSetup, type SetupApi } from "./setup.js";

describe("bot setup", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("publishes a web app menu button when APP_URL is set", async () => {
    vi.stubEnv("APP_URL", "https://example.test/app");
    const api = {
      setMyCommands: vi.fn(async () => {}),
      setMyDescription: vi.fn(async () => {}),
      setMyShortDescription: vi.fn(async () => {}),
      setChatMenuButton: vi.fn(async () => {}),
    } as unknown as SetupApi;

    await publishBotSetup(api);

    expect(api.setChatMenuButton).toHaveBeenCalledWith({
      menu_button: {
        type: "web_app",
        text: "Open app",
        web_app: { url: "https://example.test/app" },
      },
    });
  });

  it("publishes localized commands, descriptions, and the commands menu", async () => {
    vi.stubEnv("APP_URL", "");
    const api = {
      setMyCommands: vi.fn(async () => {}),
      setMyDescription: vi.fn(async () => {}),
      setMyShortDescription: vi.fn(async () => {}),
      setChatMenuButton: vi.fn(async () => {}),
    } as unknown as SetupApi;
    await publishBotSetup(api);
    expect(api.setMyCommands).toHaveBeenCalledTimes(3);
    for (const [, options] of (api.setMyCommands as ReturnType<typeof vi.fn>).mock.calls) {
      expect(options.scope).toEqual({ type: "all_private_chats" });
    }
    expect((api.setMyCommands as ReturnType<typeof vi.fn>).mock.calls[2]?.[1]).not.toHaveProperty(
      "language_code",
    );
    expect(api.setMyDescription).toHaveBeenCalledTimes(2);
    expect(api.setMyShortDescription).toHaveBeenCalledTimes(2);
    for (const [description] of (api.setMyDescription as ReturnType<typeof vi.fn>).mock.calls)
      expect(description).not.toBe("");
    for (const [description] of (api.setMyShortDescription as ReturnType<typeof vi.fn>).mock.calls)
      expect(description).not.toBe("");
    expect(api.setChatMenuButton).toHaveBeenCalledWith({ menu_button: { type: "commands" } });
  });

  it("falls back to the commands menu when APP_URL is not HTTPS", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const api = {
      setMyCommands: vi.fn(async () => {}),
      setMyDescription: vi.fn(async () => {}),
      setMyShortDescription: vi.fn(async () => {}),
      setChatMenuButton: vi.fn(async () => {}),
    } as unknown as SetupApi;

    await publishBotSetup(api);

    expect(api.setChatMenuButton).toHaveBeenCalledWith({ menu_button: { type: "commands" } });
  });
});
