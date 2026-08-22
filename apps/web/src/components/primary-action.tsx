"use client";
import { useEffect } from "react";
import { useTelegram } from "./telegram-provider";
export function PrimaryAction({ children, formId }: { children: string; formId?: string }) {
  const tg = useTelegram();
  useEffect(() => {
    if (!tg) return;
    const submit = () => {
      if (formId)
        document
          .getElementById(formId)
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    };
    tg.MainButton.setText(children);
    tg.MainButton.onClick(submit);
    tg.MainButton.show();
    return () => {
      tg.MainButton.offClick(submit);
      tg.MainButton.hide();
    };
  }, [tg, children, formId]);
  if (tg) return null;
  return (
    <button
      form={formId}
      className="flex w-full items-center justify-center rounded-input bg-ink px-4 py-4 text-lg font-bold text-surface transition-transform active:scale-[.98]"
    >
      {children}
    </button>
  );
}
