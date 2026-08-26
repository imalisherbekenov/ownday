"use client";
import * as Switch from "@radix-ui/react-switch";
import { useTelegram } from "./telegram-provider";
export function SettingsForm({
  timezone,
  dayStartHour,
  telegram,
  email,
  action,
  signOutAction,
  deleteAction,
}: {
  timezone: string;
  dayStartHour: number;
  telegram?: string | undefined;
  email?: string | undefined;
  action: (d: FormData) => Promise<void>;
  signOutAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
}) {
  // Тот же признак среды, что и у оболочки: наличие webApp, а не статус.
  const insideTelegram = useTelegram().webApp !== null;
  return (
    <form action={action} className="space-y-6">
      <Group title="Расписание">
        <Row title="Часовой пояс">
          <input className="control max-w-56" name="timezone" defaultValue={timezone} />
        </Row>
        <Row title="Начало дня" hint="Ночные отметки до этого часа относятся к предыдущему дню">
          <select className="control max-w-32" name="dayStartHour" defaultValue={dayStartHour}>
            {Array.from({ length: 13 }, (_, i) => (
              <option key={i} value={i}>
                {String(i).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </Row>
      </Group>
      <Group title="Напоминания">
        <Toggle title="Telegram" name="telegram" defaultChecked />
        <Toggle title="Push-уведомления" name="push" />
        <Row title="Тихие часы">
          <div className="flex gap-2">
            <input className="control w-28" type="time" name="quietFrom" defaultValue="22:00" />
            <input className="control w-28" type="time" name="quietTo" defaultValue="08:00" />
          </div>
        </Row>
        <Toggle title="Утренний бриф" name="brief" defaultChecked />
      </Group>
      <Group title="Аккаунт и данные">
        <Row title="Telegram" hint={telegram ? `Привязан: ${telegram}` : "Не привязан"}>
          <button type="button" className="min-h-11 font-bold text-done-ink">
            {telegram ? "Обновить" : "Привязать"}
          </button>
        </Row>
        <Row title="Email" hint={email ?? "Не указан"}>
          <button type="button" className="min-h-11 font-bold text-done-ink">
            Изменить
          </button>
        </Row>
        <Row title="Тема">
          <select className="control max-w-40" name="theme">
            <option value="system">Системная</option>
            <option value="light">Светлая</option>
            <option value="dark">Тёмная</option>
          </select>
        </Row>
        <Row title="Экспорт данных" hint="Привычки и все отметки одним файлом JSON">
          <a className="min-h-11 font-bold text-done-ink" href="/api/export">
            Скачать
          </a>
        </Row>
        {insideTelegram ? null : (
          <Row title="Выйти" hint="Сессия в этом браузере закончится">
            <button formAction={signOutAction} className="min-h-11 font-bold text-done-ink">
              Выйти
            </button>
          </Row>
        )}
        <Row title="Удалить аккаунт" hint="Это действие нельзя отменить">
          <button formAction={deleteAction} className="min-h-11 font-bold text-miss">
            Удалить
          </button>
        </Row>
      </Group>
      <button className="primary">Сохранить настройки</button>
    </form>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="label mb-3">{title}</h2>
      <div className="card divide-y divide-line-soft">{children}</div>
    </section>
  );
}
function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[68px] items-center justify-between gap-4 px-4 py-3">
      <div>
        <b>{title}</b>
        {hint && <p className="max-w-md text-sm text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
function Toggle({
  title,
  name,
  defaultChecked = false,
}: {
  title: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <Row title={title}>
      <Switch.Root name={name} defaultChecked={defaultChecked} className="switch">
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </Row>
  );
}
