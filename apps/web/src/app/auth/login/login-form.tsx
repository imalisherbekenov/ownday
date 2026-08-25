"use client";
import { useActionState } from "react";
import { requestMagicLink } from "../actions";
const initialState: { error?: string; ok?: boolean; token?: string | undefined } = {};
export function LoginForm() {
  const [state, action, pending] = useActionState(requestMagicLink, initialState);
  if (state.ok)
    return <p className="text-ink-2">Проверьте почту — мы отправили ссылку для входа.</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="label" htmlFor="email">
        Почта
      </label>
      <input
        className="control"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      {state.error ? <p className="text-sm text-ink-2">Введите корректный адрес почты.</p> : null}
      <button className="primary" disabled={pending} type="submit">
        {pending ? "Отправляем…" : "Получить ссылку для входа"}
      </button>
    </form>
  );
}
