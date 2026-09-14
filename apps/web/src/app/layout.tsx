import type { Metadata, Viewport } from "next";
import { Lora, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { TelegramProvider } from "@/components/telegram-provider";
import { AppShell } from "@/components/app-shell";
import { InterfaceLocaleProvider } from "@/components/interface-locale";
import { cookies } from "next/headers";
const nunitoSans = Nunito_Sans({
  subsets: ["latin", "cyrillic-ext"],
  variable: "--font-sans",
  display: "swap",
});
const lora = Lora({
  subsets: ["latin", "cyrillic-ext"],
  variable: "--font-display",
  display: "swap",
});
export const metadata: Metadata = {
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  title: { default: "Ownday — в твоём ритме", template: "%s · Ownday" },
  description:
    "Маленькие привычки, свой ритм. Личный дневник привычек с работой без регистрации и синхронизацией по желанию.",
};
export const viewport: Viewport = { viewportFit: "cover" };
export const runtime = "nodejs";
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies(),
    theme = jar.get("ownday_theme")?.value;
  return (
    <html
      lang={jar.get("ownday_locale")?.value === "en" ? "en" : "ru"}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
      className={`${nunitoSans.variable} ${lora.variable}`}
      suppressHydrationWarning
    >
      <body>
        <InterfaceLocaleProvider locale={jar.get("ownday_locale")?.value === "en" ? "en" : "ru"}>
          <TelegramProvider>
            <AppShell>{children}</AppShell>
          </TelegramProvider>
        </InterfaceLocaleProvider>
      </body>
    </html>
  );
}
