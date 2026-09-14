"use client";
import { useActionState } from "react";
import { useInterfaceLocale } from "@/components/interface-locale";
import { requestMagicLink, type MagicLinkState } from "../actions";
const initialState: MagicLinkState = {};
export function LoginForm() {
  const { t } = useInterfaceLocale();
  const [state, action, pending] = useActionState(requestMagicLink, initialState);
  if (state.ok)
    return (
      <p className="text-ink-2" role="status">
        {t(
          "Проверь почту — мы отправили ссылку для входа.",
          "Check your email for a sign-in link.",
        )}
      </p>
    );
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="label" htmlFor="email">
        {t("Почта", "Email")}
      </label>
      <input
        className="control"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        {...(state.error ? { "aria-invalid": true, "aria-describedby": "email-error" } : {})}
      />
      {/* Причину называет сервер: адрес не тот и «слишком часто» — разные отказы, и
          человек по ним делает разное. role="alert" — потому что сообщение появляется
          после отправки, и без него читающий с экрана не узнает о нём вовсе. */}
      {state.error ? (
        <p className="text-sm text-miss" id="email-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="primary" disabled={pending} type="submit">
        {pending
          ? t("Отправляем…", "Sending…")
          : t("Получить ссылку для входа", "Email me a sign-in link")}
      </button>
    </form>
  );
}
