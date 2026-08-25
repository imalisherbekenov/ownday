import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telegram-auth", () => ({ validateTelegramInitData: vi.fn() }));
vi.mock("@/lib/services", () => ({ services: { ensureUserFromTelegram: vi.fn() } }));
vi.mock("@/lib/session", () => ({ issueSession: vi.fn() }));

import { issueSession } from "@/lib/session";
import { services } from "@/lib/services";
import { validateTelegramInitData } from "@/lib/telegram-auth";
import { POST } from "./route";

const request = () =>
  new Request("http://localhost/api/auth/telegram", {
    method: "POST",
    body: JSON.stringify({ initData: "signed-payload", timezone: "Asia/Tashkent" }),
  });

describe("POST /api/auth/telegram", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("reports a server configuration error when TELEGRAM_BOT_TOKEN is absent", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const response = await POST(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Telegram authorization is not configured",
    });
  });

  it("returns 401 when Telegram initData validation fails", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "configured-token");
    vi.mocked(validateTelegramInitData).mockImplementation(() => {
      throw new Error("INVALID_INIT_DATA");
    });
    const response = await POST(request());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid Telegram authorization" });
  });

  it("reports a server fault, not a bad signature, when the session cannot be issued", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "configured-token");
    vi.mocked(validateTelegramInitData).mockReturnValue({ id: 42, first_name: "Ada" });
    vi.mocked(services.ensureUserFromTelegram).mockRejectedValue(new Error("DB_UNREACHABLE"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Telegram authorization failed" });
  });

  it("creates the Telegram account and session on success", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "configured-token");
    vi.mocked(validateTelegramInitData).mockReturnValue({
      id: 42,
      first_name: "Ada",
      language_code: "ru",
    });
    vi.mocked(services.ensureUserFromTelegram).mockResolvedValue({ id: "user-42" } as never);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(validateTelegramInitData).toHaveBeenCalledWith("signed-payload", "configured-token");
    expect(services.ensureUserFromTelegram).toHaveBeenCalledWith("42", {
      timezone: "Asia/Tashkent",
      locale: "ru",
    });
    expect(issueSession).toHaveBeenCalledWith("user-42");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
