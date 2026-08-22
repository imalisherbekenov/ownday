import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TelegramProvider } from "@/components/telegram-provider";
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
export const runtime = "nodejs";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${hanken.variable} ${jetbrains.variable}`}>
      <body>
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
