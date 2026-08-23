import { describe, expect, it, vi } from "vitest";
import { setupBot, type SetupApi } from "./setup.js";

describe("bot setup", () => {
  it("publishes localized commands, descriptions, and the commands menu", async () => {
    const api = {
      setMyCommands: vi.fn(async () => {}),
      setMyDescription: vi.fn(async () => {}),
      setMyShortDescription: vi.fn(async () => {}),
      setChatMenuButton: vi.fn(async () => {}),
    } as unknown as SetupApi;
    await setupBot(api);
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
  });
});
