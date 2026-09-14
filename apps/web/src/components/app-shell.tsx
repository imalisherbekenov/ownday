"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTelegram } from "./telegram-provider";
import { MiniAppBackButton } from "./mini-app-back-button";
import { useInterfaceLocale } from "./interface-locale";
import { JournalIcon } from "./journal-icon";
const items = [
  { href: "/today", label: "Сегодня", en: "Today", icon: "sun" },
  { href: "/habits", label: "Привычки", en: "Habits", icon: "grid" },
  { href: "/stats", label: "Прогресс", en: "Progress", icon: "chart" },
  { href: "/settings", label: "Настройки", en: "Settings", icon: "settings" },
];
function active(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    telegram = useTelegram();
  const router = useRouter();
  useEffect(() => {
    if (path === "/" && telegram.status === "ready" && telegram.webApp) router.replace("/today");
  }, [path, telegram.status, telegram.webApp, router]);
  if (path === "/" || path === "/privacy" || path === "/support" || path.startsWith("/auth/"))
    return <>{children}</>;
  if (telegram.webApp !== null) return <MiniAppShell path={path}>{children}</MiniAppShell>;
  return <WebShell path={path}>{children}</WebShell>;
}
function WebShell({ children, path }: { children: React.ReactNode; path: string }) {
  const { t } = useInterfaceLocale();
  return (
    <div className="min-h-[100dvh] lg:pl-[240px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] border-r border-line-soft bg-surface p-6 lg:flex lg:flex-col">
        <Link href="/" className="mb-8 text-2xl font-extrabold tracking-[-.03em]">
          ownday<span className="text-done">.</span>
        </Link>
        <nav
          className="flex flex-col gap-2"
          aria-label={t("Основная навигация", "Main navigation")}
        >
          {items.map((x) => (
            <NavItem key={x.href} {...x} selected={active(path, x.href)} />
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-line-soft pt-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-done-soft font-bold text-done-ink">
            OD
          </span>
          <div>
            <b className="block">{t("Мой день", "My day")}</b>
            <span className="text-sm text-ink-3">{t("В своём ритме", "At your own pace")}</span>
          </div>
        </div>
      </aside>
      {/* Запас снизу считается так же, как в Mini App: фиксированные 4rem не знают про
          домашнюю полосу айфона, а нижняя навигация на неё вырастает — и последняя
          строка контента уезжает под неё. */}
      <div className="mx-auto w-full max-w-[900px] pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-line-soft bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label={t("Нижняя навигация", "Bottom navigation")}
      >
        {items.map((x) => (
          <NavItem key={x.href} {...x} selected={active(path, x.href)} mobile />
        ))}
      </nav>
    </div>
  );
}
function MiniAppShell({ children, path }: { children: React.ReactNode; path: string }) {
  const { t } = useInterfaceLocale();
  const { webApp } = useTelegram();
  useEffect(() => {
    const app = webApp as
      | (typeof webApp & {
          isVersionAtLeast?: (version: string) => boolean;
          disableVerticalSwipes?: () => void;
        })
      | null;
    if (app?.isVersionAtLeast?.("7.7")) app.disableVerticalSwipes?.();
  }, [webApp]);
  return (
    <div className="min-h-[100dvh] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <MiniAppBackButton />
      <div className="mx-auto w-full max-w-[900px]">{children}</div>
      <nav
        className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-line-soft bg-surface pb-[env(safe-area-inset-bottom)]"
        aria-label={t("Нижняя навигация", "Bottom navigation")}
      >
        {items.map((x) => (
          <NavItem key={x.href} {...x} selected={active(path, x.href)} mobile />
        ))}
      </nav>
    </div>
  );
}
function NavItem({
  href,
  label,
  en,
  icon,
  selected,
  mobile = false,
}: {
  href: string;
  label: string;
  en: string;
  icon: string;
  selected: boolean;
  mobile?: boolean;
}) {
  const { t } = useInterfaceLocale();
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      className={`${mobile ? "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs" : "flex min-h-11 items-center gap-3 rounded-input px-3"} ${selected ? "bg-done-soft text-done-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink"}`}
    >
      <JournalIcon name={icon} />
      <span>{t(label, en)}</span>
    </Link>
  );
}
