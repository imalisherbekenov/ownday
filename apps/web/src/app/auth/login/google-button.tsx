"use client";
import { useEffect, useState } from "react";
import { useInterfaceLocale } from "@/components/interface-locale";

// Часовой пояс знает только браузер: сервер его не выведет, а Google в id_token
// не кладёт. Здесь он и называется, дальше едет в куке транзакции до возврата.
// До гидрации ссылка ведёт без пояса — тогда сервер честно возьмёт UTC.
export function GoogleButton() {
  const { t } = useInterfaceLocale();
  const [href, setHref] = useState("/auth/google");
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) setHref(`/auth/google?tz=${encodeURIComponent(timezone)}`);
  }, []);
  return (
    <a className="primary text-center" href={href}>
      {t("Продолжить с Google", "Continue with Google")}
    </a>
  );
}
