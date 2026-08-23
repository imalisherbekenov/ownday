# 02 — SDK, светлота и вход по Telegram

**Требования:** R01, R01.1, R01.2, R01.3, R05i, R05i.1, R08i, R08i.1, R08i.2, R09i.1, R11i, A01
**Blocked by:** 01
**Зона:** `apps/web/src/app/layout.tsx` · `apps/web/src/components/telegram-provider.tsx` · `apps/web/src/app/api/auth/telegram/route.ts` · **(расширено по D02)** `app-shell.tsx`, `primary-action-adapter.tsx`, `habit-row-adapter.tsx` — только приведение мест вызова
**Волна:** 2
**Status:** ready

## Что должно заработать

Приложение, открытое внутри Telegram, узнаёт человека само и показывает его привычки —
без единого экрана логина. Открытое в обычном браузере, оно ведёт себя как обычный веб.
Если вход не удался, человек видит, что случилось, и кнопку «повторить», а не пустой экран.

Сейчас не работает ничего из этого, и по одной причине: скрипт Telegram нигде не
подключён, `window.Telegram` всегда `undefined`, провайдер делает ранний выход. Проверка
подписи `initData` написана и корректна — её просто никто не вызывает.

## Из брифа, дословно

> «Mini App физически не работает и никогда не работал. Скрипт `telegram-web-app.js`
> нигде не подключён, поэтому `window.Telegram` всегда `undefined`, провайдер делает
> ранний выход, и весь написанный код темы, MainButton и haptic ни разу не исполнялся.
> Проверка `initData` реализована корректно, но её никто не вызывает.»

> «Палитра Ownday, из Telegram — только светло/темно»

## Разделы спецификации

Истории 1–4, 7–8, 16–19, 24, 28. Решения §1, §2, §3, §4, §11, §14, §17.

## Критерии приёмки

- [ ] `telegram-web-app.js` подключён в `layout.tsx` со `strategy="beforeInteractive"`
- [ ] Инлайновый **блокирующий** скрипт в `<head>` синхронно ставит на `<html>`
      `data-mini-app="true"` и `data-theme` по `colorScheme` — до первой отрисовки.
      Соглашение `:root[data-mini-app="true"]` в `globals.css:55` уже существует
- [ ] Внутри Telegram нет вспышки чужой темы на старте
- [ ] **Отображение `themeParams` на переменные Ownday удалено целиком** — все шесть
      строк (`bg_color → --color-ground` и остальные). Из темы Telegram берётся только
      `colorScheme`. Зелёный остаётся зелёным при любой теме клиента
- [ ] Провайдер вызывает `POST /api/auth/telegram` при непустом `initData` и передаёт
      **реальный** часовой пояс из `Intl.DateTimeFormat().resolvedOptions().timeZone`
      (маршрут сейчас подставляет `UTC`, и граница дня расходится с ботом)
- [ ] После успеха — `router.refresh()`
- [ ] `useTelegram()` отдаёт контракт из `interfaces.md`: `status`, `webApp`,
      `colorScheme`, `error`, `retry`. Форма зафиксирована — таск 04 на неё опирается
- [ ] `status === "anonymous"` — это обычный веб, а не ошибка
- [ ] Маршрут `/api/auth/telegram` перестаёт отвечать одинаковым 401 на всё: незаданный
      на сервере токен и неверная подпись — разные случаи и разные ответы
- [ ] Экран ошибки: текст и кнопка «повторить», работающая через `retry`
- [ ] `export const viewport` с `viewportFit: "cover"` — без него уже используемый
      `env(safe-area-inset-bottom)` (`globals.css:25`) возвращает ноль
- [ ] `?mockTelegram=1` в dev-сборке кладёт в `window.Telegram` заглушку: пустой
      `initData`, `colorScheme`, рабочие MainButton, BackButton и HapticFeedback.
      В проде (`NODE_ENV === "production"`) заглушка недоступна
- [ ] Обычный веб не изменился: 12 существующих тестов зелёные
- [ ] `npx turbo run test typecheck build format:check --force` зелёный
