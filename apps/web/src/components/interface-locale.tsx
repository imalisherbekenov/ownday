"use client";
import { createContext, useCallback, useContext } from "react";
export type InterfaceLocale = "ru" | "en";
const LocaleContext = createContext<InterfaceLocale>("ru");
export function InterfaceLocaleProvider({
  locale,
  children,
}: {
  locale: InterfaceLocale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useInterfaceLocale() {
  const locale = useContext(LocaleContext);
  const t = useCallback((ru: string,en:string)=>locale === "ru"?ru:en,[locale]);
  return { locale, t };
}
