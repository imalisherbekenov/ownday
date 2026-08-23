"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TelegramButton = {
  setText(text: string): void;
  show(): void;
  hide(): void;
  onClick(handler: () => void): void;
  offClick(handler: () => void): void;
};

type TelegramBackButton = Omit<TelegramButton, "setText">;

export type TelegramWebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  ready(): void;
  expand(): void;
  MainButton: TelegramButton;
  BackButton: TelegramBackButton;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy"): void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export type TelegramStatus = "checking" | "ready" | "anonymous" | "error";

export type TelegramContext = {
  status: TelegramStatus;
  webApp: TelegramWebApp | null;
  colorScheme: "light" | "dark" | null;
  error: string | null;
  retry: () => void;
};

const Context = createContext<TelegramContext>({
  status: "checking",
  webApp: null,
  colorScheme: null,
  error: null,
  retry: () => undefined,
});

export function useTelegram(): TelegramContext {
  return useContext(Context);
}

function createMockTelegram(): TelegramWebApp {
  const handlers = new Set<() => void>();
  const button = {
    setText: () => undefined,
    show: () => undefined,
    hide: () => undefined,
    onClick: (handler: () => void) => handlers.add(handler),
    offClick: (handler: () => void) => handlers.delete(handler),
  };
  return {
    initData: "mock-telegram-init-data",
    colorScheme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    ready: () => undefined,
    expand: () => undefined,
    MainButton: button,
    BackButton: {
      show: () => undefined,
      hide: () => undefined,
      onClick: (handler) => handlers.add(handler),
      offClick: (handler) => handlers.delete(handler),
    },
    HapticFeedback: { impactOccurred: () => undefined },
  };
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Omit<TelegramContext, "retry">>({
    status: "checking",
    webApp: null,
    colorScheme: null,
    error: null,
  });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const initialise = () => {
      const mockRequested = new URLSearchParams(window.location.search).get("mockTelegram") === "1";
      const mockEnabled =
        process.env.NODE_ENV !== "production" &&
        mockRequested &&
        !window.Telegram?.WebApp?.initData;
      if (mockEnabled) {
        window.Telegram = { WebApp: createMockTelegram() };
      }

      const candidate = window.Telegram?.WebApp;
      const webApp = candidate?.initData ? candidate : null;
      if (!webApp) {
        setState({ status: "anonymous", webApp: null, colorScheme: null, error: null });
        return;
      }

      const colorScheme = webApp.colorScheme ?? null;
      webApp.ready();
      webApp.expand();

      if (mockEnabled) {
        setState({ status: "ready", webApp, colorScheme, error: null });
        return;
      }

      setState({ status: "checking", webApp, colorScheme, error: null });
      void fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: webApp.initData,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error || "Не удалось войти через Telegram");
          }
          if (!cancelled) {
            setState({ status: "ready", webApp, colorScheme, error: null });
            router.refresh();
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setState({
              status: "error",
              webApp,
              colorScheme,
              error: error instanceof Error ? error.message : "Не удалось войти через Telegram",
            });
          }
        });
    };

    const sdkScript = document.getElementById("telegram-web-app-sdk");
    const sdkAlreadyLoaded = document.documentElement.dataset.telegramSdkLoaded === "true";
    if (sdkAlreadyLoaded || window.Telegram?.WebApp) initialise();
    else if (sdkScript) sdkScript.addEventListener("load", initialise, { once: true });
    else initialise();

    return () => {
      cancelled = true;
      sdkScript?.removeEventListener("load", initialise);
    };
  }, [attempt, router]);

  const value = useMemo(() => ({ ...state, retry }), [retry, state]);
  return (
    <Context.Provider value={value}>
      {state.status === "error" ? (
        <main role="alert">
          <p>{state.error}</p>
          <button type="button" onClick={retry}>
            Повторить
          </button>
        </main>
      ) : (
        children
      )}
    </Context.Provider>
  );
}
