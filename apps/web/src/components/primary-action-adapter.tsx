"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { PrimaryAction, type LinkRenderer } from "@ownday/ui";
import { useTelegram } from "./telegram-provider";

const renderLink: LinkRenderer = ({ href, children, className }) => (
  <Link href={href} className={className}>
    {children}
  </Link>
);

export function PrimaryActionAdapter({
  children,
  formId,
  href,
}: {
  children: ReactNode;
  formId?: string;
  href?: string;
}) {
  const telegram = useTelegram();
  const label = typeof children === "string" ? children : "Continue";
  useEffect(() => {
    if (!telegram.webApp || telegram.isMock || !formId) return;
    const { MainButton } = telegram.webApp;
    const target = document.getElementById(formId ?? "");
    const form = target instanceof HTMLFormElement ? target : target?.querySelector("form");
    const nativeButton = form?.querySelector<HTMLButtonElement>("button.primary");
    if (nativeButton) nativeButton.hidden = true;
    // MainButton нажимается сколько угодно раз, и каждое нажатие — отдельная запись
    // на сервере: на медленной связи так получаются дубли одной привычки. Идёт ли
    // отправка, уже знает нативная кнопка формы — useFormStatus гасит её, пока ответ
    // в пути. Поэтому она здесь и сторож, и способ ожить: сервер отказал, страница
    // осталась на месте, кнопка отпустилась — MainButton отпускается следом.
    // Потолок: между двумя нажатиями React должен успеть перерисовать форму. Для
    // пальца это вечность, для скрипта — нет.
    const submit = () => {
      if (nativeButton?.disabled) return;
      form?.requestSubmit();
    };
    const mirrorPending = () => {
      if (nativeButton?.disabled) {
        MainButton.showProgress?.(false);
        MainButton.disable?.();
      } else {
        MainButton.hideProgress?.();
        MainButton.enable?.();
      }
    };
    let pendingWatch: MutationObserver | undefined;
    if (nativeButton) {
      pendingWatch = new MutationObserver(mirrorPending);
      pendingWatch.observe(nativeButton, { attributes: true, attributeFilter: ["disabled"] });
    }
    MainButton.setText(label);
    MainButton.onClick(submit);
    MainButton.show();
    return () => {
      pendingWatch?.disconnect();
      MainButton.offClick(submit);
      MainButton.hideProgress?.();
      MainButton.enable?.();
      MainButton.hide();
      if (nativeButton) nativeButton.hidden = false;
    };
  }, [telegram.webApp, telegram.isMock, label, formId]);
  return (
    <PrimaryAction formId={formId} href={href} renderLink={renderLink} hidden={Boolean(formId)}>
      {children}
    </PrimaryAction>
  );
}
