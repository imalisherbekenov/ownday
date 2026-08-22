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
    if (!telegram) return;
    const submit = () => {
      if (formId)
        document
          .getElementById(formId)
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    };
    telegram.MainButton.setText(label);
    telegram.MainButton.onClick(submit);
    telegram.MainButton.show();
    return () => {
      telegram.MainButton.offClick(submit);
      telegram.MainButton.hide();
    };
  }, [telegram, label, formId]);
  return (
    <PrimaryAction formId={formId} hidden={Boolean(telegram)}>
      {children}
    </PrimaryAction>
  );
}
