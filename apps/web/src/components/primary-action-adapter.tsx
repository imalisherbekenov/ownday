"use client";

import { useEffect, type ReactNode } from "react";
import { PrimaryAction } from "@ownday/ui";
import { useTelegram } from "./telegram-provider";

export function PrimaryActionAdapter({
  children,
  formId,
}: {
  children: ReactNode;
  formId?: string;
}) {
  const telegram = useTelegram();
  const label = typeof children === "string" ? children : "Continue";
  useEffect(() => {
    if (!telegram.webApp) return;
    const { MainButton } = telegram.webApp;
    const submit = () => {
      if (formId)
        document
          .getElementById(formId)
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    };
    MainButton.setText(label);
    MainButton.onClick(submit);
    MainButton.show();
    return () => {
      MainButton.offClick(submit);
      MainButton.hide();
    };
  }, [telegram.webApp, label, formId]);
  return (
    <PrimaryAction formId={formId} hidden={telegram.webApp !== null}>
      {children}
    </PrimaryAction>
  );
}
