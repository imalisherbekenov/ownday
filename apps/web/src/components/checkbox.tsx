"use client";
import { useFormStatus } from "react-dom";
import { CheckIcon } from "./icons";
import { useTelegram } from "./telegram-provider";
export function Checkbox({ checked, label }: { checked: boolean; label: string }) {
  const { pending } = useFormStatus();
  const tg = useTelegram();
  return (
    <button
      name="intent"
      value={checked ? "undo" : "done"}
      disabled={pending}
      onClick={() => tg?.HapticFeedback?.impactOccurred("light")}
      aria-label={`${checked ? "Undo" : "Complete"} ${label}`}
      aria-pressed={checked}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-check disabled:opacity-50 ${checked ? "bg-done text-surface" : "border-2 border-line bg-transparent text-transparent"}`}
    >
      <CheckIcon className="h-5 w-5" />
    </button>
  );
}
