"use client";
import { useState } from "react";
import Link from "next/link";
import { useInterfaceLocale } from "./interface-locale";
export function InformationPage({ kind }: { kind: "privacy" | "support" }) {
  const { locale } = useInterfaceLocale();
  const [en, setEn] = useState(locale === "en"),
    t = (ru: string, english: string) => (en ? english : ru);
  const sections =
    kind === "privacy"
      ? [
          [
            t("Разработчик и связь", "Developer and contact"),
            t(
              "Ownday разрабатывает Alisher Bekenov. Вопросы о данных и работе приложения: alifarlinbekenov21@gmail.com.",
              "Ownday is developed by Alisher Bekenov. For questions about your data or the app: alifarlinbekenov21@gmail.com.",
            ),
          ],
          [
            t("Без аккаунта", "Without an account"),
            t(
              "Мобильное приложение хранит привычки, расписания, отметки и настройки в локальной базе на устройстве. При удалении приложения эти данные могут быть удалены системой. Экспорт позволяет сохранить собственную копию.",
              "The mobile app stores habits, schedules, check-ins and preferences in a local database on your device. Uninstalling the app may remove this data. Export lets you keep your own copy.",
            ),
          ],
          [
            t("С аккаунтом", "With an account"),
            t(
              "Для синхронизации сервер хранит привычки и историю, настройки часового пояса и языка, идентификатор аккаунта и записи операций. При входе через провайдера сохраняется его идентификатор; для входа по почте используется адрес электронной почты. Названия привычек передаются серверу при синхронизации.",
              "For sync, the server stores habits and history, time zone and language settings, the account identifier and operation records. Provider sign-in stores the provider identifier; email sign-in uses your email address. Habit titles are sent to the server during sync.",
            ),
          ],
          [
            t("Сессии и настройки", "Sessions and preferences"),
            t(
              "Веб-версия использует cookie сессии, языка и оформления. Неподтверждённые действия сохраняются в хранилище вкладки до получения ответа; закрытие вкладки может удалить их. Мобильный токен хранится в защищённом хранилище системы. При выходе серверная сессия отзывается; без сети запрос отзыва сохраняется до восстановления связи.",
              "The web app uses cookies for your session, language and appearance. Unconfirmed changes are kept in tab storage until acknowledged; closing the tab may remove them. Mobile tokens are stored in system secure storage. Signing out revokes the server session; offline revocation is queued until a connection is available.",
            ),
          ],
          [
            t("Экспорт и удаление", "Export and deletion"),
            t(
              "Экспорт мобильного приложения включает историю и сохранённые варианты конфликтов. Удаление аккаунта доступно в настройках веб-версии и удаляет связанные серверные записи. Сохранённые экспорты и локальные копии на устройствах нужно удалить отдельно.",
              "Mobile export includes history and preserved conflict versions. Account deletion is available in web settings and removes associated server records. Exported files and local device copies must be removed separately.",
            ),
          ],
          [
            t("Статус продукта", "Product status"),
            t(
              "Ownday готовится к первому мобильному выпуску. Эта страница описывает текущую реализацию. Сроки хранения резервных копий и окончательные условия сервиса будут опубликованы до выпуска.",
              "Ownday is preparing its first mobile release. This page describes the current implementation. Backup retention and final service terms will be published before release.",
            ),
          ],
        ]
      : [
          [
            t("Изменения не синхронизируются", "Changes are not syncing"),
            t(
              "Открой настройки мобильного приложения и нажми «Синхронизировать». Если сессия истекла, войди снова в тот же аккаунт. Локальные записи сохраняются при отсутствии связи.",
              "Open mobile settings and choose Sync now. If your session has expired, sign in to the same account again. Local records are kept when the network is unavailable.",
            ),
          ],
          [
            t("Появился конфликт", "A conflict appeared"),
            t(
              "Сравни версию устройства и сервера в настройках. Выбери нужную: обе версии останутся в истории конфликтов и экспорте. Независимые положительные прибавления счётчиков суммируются автоматически.",
              "Compare the device and server versions in settings. Choose one: both remain in conflict history and export. Independent positive counter increments are added automatically.",
            ),
          ],
          [
            t("Как сохранить копию", "Keeping a backup"),
            t(
              "Открой настройки и выбери «Экспортировать данные». Сохрани JSON-файл в удобном месте. Он содержит названия привычек и историю, поэтому делись им только намеренно.",
              "Open settings and choose Export data. Save the JSON file somewhere convenient. It contains habit names and history, so share it intentionally.",
            ),
          ],
          [
            t("Сообщить об ошибке", "Report an issue"),
            t(
              "Опиши шаги воспроизведения, устройство и версию приложения в GitHub Issues. Не добавляй токены входа и личную историю в публичное обращение.",
              "Describe the steps, device and app version in GitHub Issues. Keep sign-in tokens and personal history out of a public issue.",
            ),
          ],
        ];
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <header className="mb-14 flex items-center justify-between">
        <Link href="/" className="font-display text-3xl font-bold">
          ownday.
        </Link>
        <button
          className="min-h-11 px-4"
          onClick={() => {
            setEn(!en);
            document.documentElement.lang = en ? "ru" : "en";
            document.cookie = `ownday_locale=${en ? "ru" : "en"}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          }}
        >
          {en ? "Русский" : "English"}
        </button>
      </header>
      <h1 className="mb-10 text-4xl">
        {kind === "privacy"
          ? t("Данные и приватность", "Data & privacy")
          : t("Мы рядом", "Here to help")}
      </h1>
      {sections.map(([title, body]) => (
        <section className="mb-8" key={title}>
          <h2 className="mb-3 text-2xl">{title}</h2>
          <p className="leading-7 text-ink-3">{body}</p>
        </section>
      ))}
      <footer className="flex flex-wrap gap-6 border-t border-line-soft py-6">
        <a className="break-all" href="mailto:alifarlinbekenov21@gmail.com">
          alifarlinbekenov21@gmail.com
        </a>
        <Link href="/">{t("На главную", "Home")}</Link>
        <Link href="/today">{t("Открыть веб-приложение", "Open the web app")}</Link>
        {kind === "support" && (
          <a href="https://github.com/imalisherbekenov/ownday/issues">GitHub Issues ↗</a>
        )}
      </footer>
    </main>
  );
}
