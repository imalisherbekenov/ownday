import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TelegramProvider } from "@/components/telegram-provider";
import { AppShell } from "@/components/app-shell";
import { cookies } from "next/headers";
const hanken = Hanken_Grotesk({
  subsets: ["latin", "cyrillic-ext"],
  variable: "--font-hanken",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains",
  display: "swap",
});
export const metadata: Metadata = {
  title: { default: "Habits", template: "%s · Habits" },
  description: "A calm, focused habit tracker",
};
export const viewport: Viewport = { viewportFit: "cover" };
export const runtime = "nodejs";
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = (await cookies()).get("ownday_theme")?.value;
  return (
    <html
      lang="ru"
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
      className={`${hanken.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script id="telegram-web-app-sdk" src="https://telegram.org/js/telegram-web-app.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var root=document.documentElement;root.dataset.telegramSdkLoaded="true";var app=window.Telegram&&window.Telegram.WebApp;if(!app||!app.initData)return;root.dataset.miniApp="true";if(app.colorScheme==="light"||app.colorScheme==="dark")root.dataset.theme=app.colorScheme;}());`,
          }}
        />
      </head>
      <body>
        <TelegramProvider>
          <AppShell>{children}</AppShell>
        </TelegramProvider>
      </body>
    </html>
  );
}
