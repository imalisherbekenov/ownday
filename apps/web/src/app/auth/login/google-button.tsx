"use client";
import { useEffect, useState } from "react";

// Часовой пояс знает только браузер: сервер его не выведет, а Google в id_token
// не кладёт. Здесь он и называется, дальше едет в куке транзакции до возврата.
// До гидрации ссылка ведёт без пояса — тогда сервер честно возьмёт UTC.
export function GoogleButton() {
  const [href, setHref] = useState("/auth/google");
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) setHref(`/auth/google?tz=${encodeURIComponent(timezone)}`);
  }, []);
  return (
    <a className="primary text-center" href={href}>
      Продолжить с Google
    </a>
  );
}
