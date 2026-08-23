"use client";

import type { ReactNode } from "react";
import type { LinkRenderer } from "./habit-row";

export type PrimaryActionProps = {
  children: ReactNode;
  formId?: string | undefined;
  href?: string | undefined;
  renderLink?: LinkRenderer;
  onClick?: (() => void) | undefined;
  hidden?: boolean | undefined;
};
const className =
  "flex min-h-11 w-full items-center justify-center rounded-input bg-ink px-4 py-4 text-lg font-bold text-surface transition-transform active:scale-[.98]";

export function PrimaryAction({
  children,
  formId,
  href,
  renderLink,
  onClick,
  hidden = false,
}: PrimaryActionProps) {
  if (hidden) return null;
  if (href) {
    const linkProps = { href, className, children };
    return renderLink ? renderLink(linkProps) : <a {...linkProps} />;
  }
  return (
    <button
      type={formId ? "submit" : "button"}
      form={formId}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}
