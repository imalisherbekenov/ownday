"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
  const submitting = useRef(false);
  const label = typeof children === "string" ? children : "Continue";
  useEffect(() => {
    if (!telegram.webApp || telegram.isMock || !formId) return;
    const { MainButton } = telegram.webApp;
    const target = document.getElementById(formId ?? "");
    const form = target instanceof HTMLFormElement ? target : target?.querySelector("form");
    const nativeButton = form?.querySelector<HTMLButtonElement>("button.primary");
    if (nativeButton) nativeButton.hidden = true;
    // MainButton нажимается сколько угодно раз, и каждое нажатие — отдельная запись
    // на сервере. На медленной связи так получаются дубли одной привычки. Отправка
    // здесь одна: дальше страница уходит на другой маршрут и адаптер размонтируется.
    const submit = () => {
      if (submitting.current) return;
      submitting.current = true;
      MainButton.showProgress?.(false);
      MainButton.disable?.();
      form?.requestSubmit();
    };
    MainButton.setText(label);
    MainButton.onClick(submit);
    MainButton.show();
    return () => {
      MainButton.offClick(submit);
      MainButton.hideProgress?.();
      MainButton.enable?.();
      MainButton.hide();
      submitting.current = false;
      if (nativeButton) nativeButton.hidden = false;
    };
  }, [telegram.webApp, telegram.isMock, label, formId]);
  return (
    <PrimaryAction formId={formId} href={href} renderLink={renderLink} hidden={Boolean(formId)}>
      {children}
    </PrimaryAction>
  );
}
