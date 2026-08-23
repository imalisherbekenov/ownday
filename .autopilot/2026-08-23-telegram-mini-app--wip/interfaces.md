# Интерфейсы

Читается каждым субагентом **до** написания кода. Первая часть — решено в спецификации,
менять нельзя без возврата к оркестратору. Вторая часть растёт по мере того, как таски
сдаются.

## Правила проекта

**Стек.** pnpm workspaces + Turborepo, TypeScript strict, ESM, Node 22. Веб — Next.js 15
App Router + Tailwind + tRPC. Бот — grammY. База — PostgreSQL через Prisma.

**Команды.** Из корня репозитория:

| Команда | Что делает |
|---|---|
| `pnpm typecheck` | типы по всему воркспейсу |
| `pnpm test` | тесты |
| `pnpm build` | сборка |
| `pnpm format:check` | форматирование |
| `npx turbo run test --force` | тесты в обход кэша Turbo |

**Кэш Turbo умеет показывать зелёные ворота на непроверенном коде.** Перед тем как
отчитаться, прогони с `--force` — иначе увидишь чужой кэш вместо своей работы.

**Цвета.** Литеральных хексов в коде нет. Всё — через токены из `@ownday/tokens`, которые
генерируются из `docs/design.md`. Токен, которого не хватает, — повод вернуться к
оркестратору, а не вписать значение руками.

**Чего не трогать:**

- `packages/core` — доменная логика, к этой задаче отношения не имеет
- `packages/db/prisma/schema.prisma` — миграций в этом прогоне нет
- `apps/mobile` — вне прогона
- `apps/bot/src/handlers.ts` — только что принят, 92 теста; трогать разрешено **только**
  таску 03 и только в части кнопки входа

**Недостающая зависимость — это `BLOCKED`, а не `pnpm add`.** Вернись с вопросом.

**Секреты.** Ни один ключ, токен или строка подключения не попадает в код, в тест, в
коммит и в отчёт. Только имена переменных и `.env.example` с пустыми значениями.

## Границы, решённые в спецификации

Скопировано из `spec.md` дословно. Это контракт между тасками.

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `apps/web/src/lib/session` | сессионной кукой и её атрибутами | `issueSession(userId)`, `readSession()`, `readSessionFromRequest(req)`, `clearSession()`, `sessionCookieOptions()` | имя куки, срок, `SameSite`/`Secure` и переключатель `CROSS_SITE_COOKIES` |
| `apps/web/src/components/telegram-provider` | определением среды Telegram и входом | `useTelegram() -> { status, webApp, colorScheme }` | SDK, вызов `/api/auth/telegram`, заглушку `?mockTelegram=1` |
| `apps/web/src/components/app-shell` | обвязкой экрана | `<AppShell>` | какая из оболочек выбрана — веб или Mini App |
| `apps/web/src/components/mini-app-back-button` | кнопкой «назад» Telegram | `<MiniAppBackButton>` | список вложенных маршрутов и проверку истории |
| `apps/web/src/components/primary-action-adapter` | телеграмовской MainButton — единолично | `<PrimaryActionAdapter formId>` | подписку/отписку обработчика и выбор между MainButton и обычной кнопкой |
| `apps/bot/src/setup` | тем, что бот рассказывает о себе Telegram | `publishBotSetup(api)` | наличие `APP_URL` и выбор типа кнопки меню |

### Контракт `useTelegram()` — согласован тасками 02, 04

Таск 02 его создаёт, таск 04 им пользуется. Форма зафиксирована здесь, чтобы они не
разошлись:

```ts
type TelegramStatus = "checking" | "ready" | "anonymous" | "error";

type TelegramContext = {
  status: TelegramStatus;
  webApp: TelegramWebApp | null;   // null вне Telegram
  colorScheme: "light" | "dark" | null;
  error: string | null;            // человекочитаемое, для экрана ошибки
  retry: () => void;               // повтор авторизации
};

function useTelegram(): TelegramContext;
```

`status === "anonymous"` означает «мы не в Telegram» — это **не ошибка**, это обычный веб.
Оболочка выбирается по `webApp !== null`, а не по `status`.

### Швы для тестов — два, оба существуют

- `apps/web/src/lib/session.ts` — чистая `sessionCookieOptions()` и парность
  `issueSession` / `clearSession`. Юнит-тест, без браузера.
- `apps/bot/src/setup.ts` — `publishBotSetup(api)` принимает минимальный интерфейс API и
  уже покрыт моком. Добавляются случаи «`APP_URL` задан» и «не задан».

Новых швов не заводить. Поведение оболочки, BackButton и MainButton проверяется руками по
чек-листу приёмки — рендер-тесты Next здесь дороже пользы.

## Что построено (растёт по мере сдачи тасков)

_(пусто — ни один таск ещё не сдан)_
