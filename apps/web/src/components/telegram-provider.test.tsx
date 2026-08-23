import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const router = { refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { TelegramProvider, type TelegramWebApp, useTelegram } from "./telegram-provider";

function createWebApp(initData: string): TelegramWebApp {
  return {
    initData,
    colorScheme: "dark",
    ready: vi.fn(),
    expand: vi.fn(),
    MainButton: {
      setText: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    },
    BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
  };
}

function Probe() {
  const telegram = useTelegram();
  return (
    <div>
      <span>{telegram.status}</span>
      <span>{telegram.webApp === null ? "no-web-app" : "telegram-web-app"}</span>
    </div>
  );
}

describe("TelegramProvider", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    delete window.Telegram;
    delete document.documentElement.dataset.telegramSdkLoaded;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("enables the development mock without authenticating", async () => {
    window.history.replaceState({}, "", "/?mockTelegram=1");
    window.Telegram = { WebApp: createWebApp("") };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TelegramProvider>
        <Probe />
      </TelegramProvider>,
    );

    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    expect(screen.getByText("telegram-web-app")).toBeInTheDocument();
    expect(window.Telegram?.WebApp.initData).not.toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose the mock in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    window.history.replaceState({}, "", "/?mockTelegram=1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TelegramProvider>
        <Probe />
      </TelegramProvider>,
    );

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    expect(screen.getByText("no-web-app")).toBeInTheDocument();
    expect(window.Telegram).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is anonymous outside Telegram even though the SDK creates WebApp", async () => {
    window.Telegram = { WebApp: createWebApp("") };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TelegramProvider>
        <Probe />
      </TelegramProvider>,
    );

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    expect(screen.getByText("no-web-app")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("authenticates non-empty initData with a fixed non-UTC timezone and refreshes", async () => {
    window.Telegram = { WebApp: createWebApp("signed-payload") };
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Asia/Tashkent",
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TelegramProvider>
        <Probe />
      </TelegramProvider>,
    );

    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: "signed-payload", timezone: "Asia/Tashkent" }),
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows an error and retries authentication", async () => {
    window.Telegram = { WebApp: createWebApp("signed-payload") };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Telegram rejected the request" }), { status: 401 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TelegramProvider>
        <Probe />
      </TelegramProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Telegram rejected the request");
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));

    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
