"use client";

import { useFormStatus } from "react-dom";
import { CheckIcon } from "./icons";

export function Checkbox({
  checked,
  label,
  onInteraction,
}: {
  checked: boolean;
  label: string;
  onInteraction?: (() => void) | undefined;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      name="intent"
      value={checked ? "undo" : "done"}
      disabled={pending}
      onClick={onInteraction}
      aria-label={`${checked ? "Undo" : "Complete"} ${label}`}
      aria-pressed={checked}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-check disabled:opacity-50 ${checked ? "bg-done text-surface" : "border-2 border-line bg-transparent text-transparent"}`}
    >
      <CheckIcon className="h-5 w-5" />
    </button>
  );
}
