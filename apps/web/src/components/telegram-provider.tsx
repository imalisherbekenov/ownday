"use client";
import { createContext, useContext, useEffect, useState } from "react";
type TelegramWebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  ready(): void;
  expand(): void;
  MainButton: {
    setText(t: string): void;
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  HapticFeedback?: { impactOccurred(style: "light"): void };
};
declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}
const Context = createContext<TelegramWebApp | null>(null);
export const useTelegram = () => useContext(Context);
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [app, setApp] = useState<TelegramWebApp | null>(null);
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    setApp(webApp);
    document.documentElement.dataset.miniApp = "true";
    if (webApp.colorScheme) document.documentElement.dataset.theme = webApp.colorScheme;
    const map: Record<string, string> = {
      bg_color: "--color-ground",
      secondary_bg_color: "--color-surface",
      text_color: "--color-ink",
      hint_color: "--color-ink-3",
      button_color: "--color-ink",
      button_text_color: "--color-surface",
    };
    for (const [key, value] of Object.entries(webApp.themeParams ?? {})) {
      const variable = map[key];
      if (variable) document.documentElement.style.setProperty(variable, value);
    }
    webApp.ready();
    webApp.expand();
    return () => {
      delete document.documentElement.dataset.miniApp;
      for (const variable of Object.values(map))
        document.documentElement.style.removeProperty(variable);
    };
  }, []);
  return <Context.Provider value={app}>{children}</Context.Provider>;
}
