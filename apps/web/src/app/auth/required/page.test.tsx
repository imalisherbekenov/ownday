import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ readSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

import { readSession } from "@/lib/session";
import AuthRequiredPage from "./page";

describe("/auth/required", () => {
  beforeEach(() => vi.clearAllMocks());

  // Внутри Telegram сессия появляется уже после первой отрисовки, и провайдер зовёт
  // router.refresh() — то есть перерисовывает этот самый адрес. Без этой ветки
  // авторизованный человек навсегда остаётся на приглашении войти.
  it("sends a visitor who already has a session to today", async () => {
    vi.mocked(readSession).mockResolvedValue("user-1");
    await expect(AuthRequiredPage()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("still invites a visitor who has no session", async () => {
    vi.mocked(readSession).mockResolvedValue(null);
    await expect(AuthRequiredPage()).resolves.toBeTruthy();
  });
});
