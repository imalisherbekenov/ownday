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
    if (!telegram.webApp || !formId) return;
    const { MainButton } = telegram.webApp;
    const target = document.getElementById(formId ?? "");
    const form = target instanceof HTMLFormElement ? target : target?.querySelector("form");
    const nativeButton = form?.querySelector<HTMLButtonElement>("button.primary");
    if (nativeButton) nativeButton.hidden = true;
    const submit = () => {
      form?.requestSubmit();
    };
    MainButton.setText(label);
    MainButton.onClick(submit);
    MainButton.show();
    return () => {
      MainButton.offClick(submit);
      MainButton.hide();
      if (nativeButton) nativeButton.hidden = false;
    };
  }, [telegram.webApp, label, formId]);
  return (
    <PrimaryAction
      formId={formId}
      href={href}
      renderLink={renderLink}
      hidden={telegram.webApp !== null && Boolean(formId)}
    >
      {children}
    </PrimaryAction>
  );
}
