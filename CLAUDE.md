<!-- autopilot:start -->

# Ownday

Трекер привычек на четырёх поверхностях: Telegram-бот, веб, Telegram Mini App и
мобильное приложение с виджетами на домашнем экране. Одно ядро, одна дизайн-система,
одна база.

## Команды

| Команда                                                             | Что делает                                        |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `pnpm install`                                                      | Установить зависимости (pnpm 10.15, Node 22)      |
| `npx turbo run test typecheck build format:check --force`           | Полные ворота приёмки в обход кэша                |
| `pnpm test` · `pnpm typecheck` · `pnpm build` · `pnpm format:check` | То же по одной задаче                             |
| `pnpm --filter @ownday/web dev`                                     | Веб и Mini App (Next dev)                         |
| `pnpm --filter @ownday/bot dev`                                     | Бот локально, long polling, `tsx --env-file=.env` |
| `pnpm --filter @ownday/db seed`                                     | Залить шаблоны привычек в базу                    |

## Структура

- `packages/core` — доменная логика без I/O: `localDateFor`, `scheduleAt`, `isDue`,
  `computeStreak`, `completionRate`, `nextFireAt`
- `packages/services` — прикладной слой над интерфейсами репозиториев; реализаций две,
  Prisma и in-memory
- `packages/db` — Prisma-схема, генерируемый клиент (`generated/client`), сид шаблонов
- `packages/tokens` — токены, генерируются из фронтматтера `docs/design.md` в CSS, TS и JSON
- `packages/ui` — общие React-компоненты, сборка tsup
- `apps/bot` — grammY: команды, мастер создания привычки, воркер напоминаний
- `apps/web` — Next.js 15 App Router: веб и Mini App, плюс tRPC для мобильного
- `apps/mobile` — Expo Router и нативные виджеты (`plugins/withOwndayNative.cjs`,
  `plugins/OwndayWidget.swift`)

## Ключевые файлы

- `apps/web/src/lib/session.ts` — единственный владелец сессионной куки:
  `issueSession` · `readSession` · `readSessionFromRequest` · `issueMobileSession` ·
  `clearSession` · `sessionCookieOptions()` ·
  `refreshSessionCookie(requestCookies, responseCookies)`. Имя куки, срок (7 дней) и
  `SameSite`/`Secure` наружу не выходят: не пиши имя куки нигде, зови `clearSession()`.
  У `refreshSessionCookie` оба хранилища кук описаны структурно, а не типами Next, —
  чтобы шов проверялся юнит-тестом.
- `apps/web/src/middleware.ts` — продлевает **существующую** сессию, новую не выдаёт.
  `config.matcher` обязан быть литералом (Next читает его статически), поэтому наружу
  торчит `MIDDLEWARE_MATCHER` — для теста.
- `apps/web/src/components/telegram-provider.tsx` — `useTelegram()` возвращает
  `{ status, webApp, colorScheme, error, retry }`, где
  `status: "checking" | "ready" | "anonymous" | "error"`. Владеет определением среды,
  вызовом `/api/auth/telegram` и dev-заглушкой. `anonymous` — это обычный веб, не ошибка.
- `apps/web/src/components/app-shell.tsx` — выбирает оболочку по `webApp !== null`,
  а не по `status`.
- `apps/web/src/components/mini-app-back-button.tsx` — BackButton Telegram; список
  вложенных маршрутов лежит внутри.
- `apps/web/src/components/primary-action-adapter.tsx` — единоличный владелец MainButton;
  пока MainButton показан, нативная `button.primary` внутри формы спрятана.
- `apps/web/src/lib/services.ts` — выбор репозиториев и `getCurrentUserId()`.
- `apps/web/src/lib/telegram-auth.ts` —
  `validateTelegramInitData(initData, botToken, now?, maxAgeSeconds = 300)`.
- `apps/bot/src/setup.ts` — `publishBotSetup(api: SetupApi)`: команды и описания на ru+en,
  кнопка меню. Web-app-кнопка появляется только при **https**-`APP_URL`.
- `apps/bot/src/keyboards.ts` — `mainMenu(lang, appUrl?)`, `todayKeyboard`, `backTo`;
  та же проверка https.
- `apps/bot/src/handlers.ts` — весь диалог; состояние мастера в `Session`, `BotContext`
  структурный, а не тип grammY, поэтому хендлеры тестируются без grammY.
- `docs/design.md` — фронтматтер и есть источник токенов.
- `packages/db/prisma/partial-index.sql` — частичный индекс, который Prisma 6 не умеет
  описать схемой. Он **намеренно не применён**: вписать в первую же будущую миграцию.
- `.claude/launch.json` — конфиг превью для веба, порт 3111.

## Архитектура

- Ядро → сервисы → поверхности. `packages/core` не знает ни про базу, ни про сеть — именно
  поэтому серия считается одинаково в боте, вебе, Mini App и виджете.
- Сервисы принимают `ServiceDependencies` (репозитории), а не Prisma. Отсюда
  `InMemory*Repository` и тесты без базы.
- Веб читает данные в Server Components и меняет их server actions (`app/**/actions.ts`).
  tRPC (`/api/trpc`) существует **только** ради мобильного клиента — в вебе не используется.
- Сессия — JWT (jose) в httpOnly-куке на 7 дней; продлевается в middleware, потому что
  Server Components не умеют ставить куки. Мобильный носит тот же JWT в
  `Authorization: Bearer`, и `readSessionFromRequest` понимает оба варианта.
- Входов три: Telegram initData (`/api/auth/telegram`), magic link (`/auth/verify`, отправка
  пока `StubMagicLinkSender`) и обмен веб-сессии на мобильный токен
  (`/api/auth/mobile/session` → `ownday://auth/callback`).
- Mini App и веб — одно приложение Next. Расходятся оболочкой (`AppShell`) и тремя
  адаптерами Telegram; больше нигде ветвления по среде нет.
- SDK Telegram подключён обычным `<script>` в `<head>` у `apps/web/src/app/layout.tsx`; соседний инлайн-скрипт
  ставит `data-mini-app` и `data-theme` до гидрации, чтобы тема не мигала.
- Без `DATABASE_URL` веб поднимается на in-memory репозиториях с демо-данными; в production
  такой откат запрещён — `getCurrentUserId()` бросает `AUTH_REQUIRED`.
- Бот хранит диалог в своём storage (`prismaSessionStorage`, таблица `BotSession`); воркер
  напоминаний — `setInterval` раз в минуту, отправка через `sendWithRetry` с уважением к
  `retry_after`.
- Мобильный работает офлайн: очередь мутаций (`apps/mobile/src/mutation-queue.ts`) и снапшот для нативного
  виджета (`apps/mobile/src/widget-snapshot.ts`) через `NativeModules.OwndayWidgetBridge`.

## Соглашения кода

- TypeScript strict, плюс `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`. ESM везде; внутри бота относительные импорты пишутся с `.js`.
- Литеральных хексов в коде нет. Цвета — токены `@ownday/tokens`, в Tailwind проброшены как
  `var(--color-*)`. Не хватает токена — правится `docs/design.md`, а не компонент.
- Два акцента, у каждого один смысл: `done` — выполнение, `streak` — серия. Цвет привычки —
  пользовательские данные: он красит иконку и линию на графике, но не чекбокс и не пилюлю.
- `skip` — осознанная заморозка: серию не рвёт и в процент выполнения не входит.
- Prettier: `printWidth: 100`, двойные кавычки, точки с запятой. `docs/` и `README.md` из
  форматирования исключены.
- Каноническое имя токена бота — `TELEGRAM_BOT_TOKEN`. `BOT_TOKEN` читается только как
  запасное, чтобы не сломать локальный `.env`; новый код пишет каноническое.

## Окружение

`.env.example` лежат у `apps/web`, `apps/bot` и `packages/db`. Имена переменных:

- `DATABASE_URL` — без неё веб вне production идёт на in-memory демо-данные.
- `TELEGRAM_BOT_TOKEN` (запасное `BOT_TOKEN`) — один секрет и на бота, и на проверку initData.
- `SESSION_SECRET` — подпись сессионных JWT.
- `CROSS_SITE_COOKIES` — `1` включает `SameSite=None; Secure`. Это решение деплоя;
  `NODE_ENV` в нём не участвует.
- `APP_URL` — https-origin веба: от него зависят кнопки Mini App у бота и magic-link.
- `WEBHOOK_URL`, `PORT` — только бот в production.
- `NODE_ENV`; `EXPO_PUBLIC_API_URL` — мобильный.

## Тесты

- Vitest везде. Веб и `packages/ui` — jsdom и Testing Library, остальное — node.
- `apps/web/vitest.config.ts` принудительно ставит `DATABASE_URL: ""`: иначе набор вёл бы
  себя по-разному в зависимости от локальной базы.
- Швов для Mini App ровно два — `apps/web/src/lib/session.ts` (атрибуты куки, парность
  issue/clear, продление) и `apps/bot/src/setup.ts` (кнопка меню при заданном и незаданном
  `APP_URL`). Оболочка, BackButton и MainButton проверяются руками: рендер-тесты Next здесь
  дороже пользы.
- `apps/web/src/middleware.test.ts` собирает regexp из экспортированного
  `MIDDLEWARE_MATCHER` — копии паттерна в тесте нет и быть не должно.
- `apps/bot/src/i18n/i18n.test.ts` сверяет наборы ключей `ru` и `en`: новая строка
  добавляется сразу в оба словаря.

## Подводные камни

- Полный прогон ворот **несовместим с поднятым dev-сервером**: тот держит DLL движка Prisma,
  и `@ownday/db#build` падает с `EPERM`. Гаси dev перед приёмкой.
- Кэш Turbo умеет показывать зелёное на непроверенном коде — при приёмке гонять с `--force`.
- `next/script` со `strategy="beforeInteractive"` в App Router **не выдаёт тега скрипта**.
  Поэтому SDK Telegram подключён обычным `<script>` в `<head>`.
- Наличие `window.Telegram.WebApp` **не означает, что мы внутри Telegram**: SDK создаёт объект
  в любом браузере. Признак среды один — непустой `initData`. Двух определений в модуле быть
  не должно, на этом сломались трижды.
- Dev-заглушка `?mockTelegram=1` живёт до конца сессии вкладки через `sessionStorage`;
  снимается закрытием вкладки.
- Экранированная точка `\.` внутри обычной строки TS теряет обратный слэш молча. Из-за этого
  матчер middleware продлевал сессию только на корне; там теперь класс символов `[.]`.
- `turbo.json`: `typecheck.dependsOn = ["^typecheck", "build"]`. Пока они шли параллельно,
  `typecheck` читал `.next/types/**`, которые `build` в тот же момент перезаписывал, и полный
  прогон то проходил, то падал. Трогал что-то, из чего Next генерирует типы, — прогоняй
  ворота больше одного раза.

## Как здесь работает Autopilot

Сборка ведётся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/`.
Прогресс — `.autopilot/dashboard.html`. Правило: требование из `manifest.md`
может снять только пользователь.

Если работа продолжается — скажи «продолжи автопилот»: состояние поднимется
из `.autopilot/state.js`, переспрашивать ничего не нужно.

<!-- autopilot:end -->
