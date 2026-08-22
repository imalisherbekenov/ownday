"use client";

import type { ReactNode } from "react";

export type PrimaryActionProps = {
  children: ReactNode;
  formId?: string | undefined;
  onClick?: (() => void) | undefined;
  hidden?: boolean | undefined;
};
export function PrimaryAction({ children, formId, onClick, hidden = false }: PrimaryActionProps) {
  if (hidden) return null;
  return (
    <button
      type={formId ? "submit" : "button"}
      form={formId}
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-center rounded-input bg-ink px-4 py-4 text-lg font-bold text-surface transition-transform active:scale-[.98]"
    >
      {children}
    </button>
  );
}
