# 01 — Сессия, куки и единое имя токена

**Требования:** R07i, R07i.1, R07i.2, R02 (частично)
**Blocked by:** —
**Зона:** `apps/web/src/lib/session.ts` · `apps/web/src/middleware.ts` · `apps/web/src/app/settings/actions.ts` · `apps/web/.env.example` · `apps/bot/src/main.ts` · `apps/bot/.env.example`
**Волна:** 1
**Status:** ready

## Что должно заработать

Сессия перестаёт быть пятнадцатиминутной и начинает долетать внутрь Telegram. Человек,
который открыл приложение из вечернего напоминания утром, остаётся залогинен. Удаление
аккаунта действительно разлогинивает. Бот и веб перестают называть один и тот же секрет
двумя разными именами.

Ничего из этого пока не видно глазами — это фундамент, на котором стоят остальные три
таска. Но два бага здесь настоящие и существующие.

## Из брифа, дословно

> «Отдельно он просит веб-интерфейс внутри Telegram»

> «кука сессии с `SameSite=Lax` в iframe Telegram не отправляется»

## Разделы спецификации

Истории 13–15. Решения §5, §6, §7, §12. Швы — первый.

## Критерии приёмки

- [ ] `sessionCookieOptions()` — чистая функция, экспортируется из `lib/session.ts`,
      возвращает `sameSite: "none", secure: true` при `CROSS_SITE_COOKIES=1` и нынешние
      `sameSite: "lax", secure: NODE_ENV==="production"` иначе
- [ ] Переключатель — **только** `CROSS_SITE_COOKIES`, не `NODE_ENV`: это решение
      развёртывания, а не режима сборки
- [ ] Срок сессии — 7 дней вместо 15 минут, и в JWT, и в `maxAge` куки
- [ ] `middleware.ts` продлевает живую сессию при активности (скользящее окно).
      Server Components куки ставить не умеют — поэтому именно middleware
- [ ] Middleware **не трогает** запросы к `/api/*` и статике, и не создаёт сессию там,
      где её не было — только продлевает существующую
- [ ] `clearSession()` экспортируется из `lib/session.ts` и используется в
      `settings/actions.ts` вместо удаления несуществующей `ownday_session`
      (сессия лежит в `habits_session` — сейчас удаление аккаунта не разлогинивает)
- [ ] Кука темы `ownday_theme` в `settings/actions.ts` получает те же атрибуты из
      `sessionCookieOptions()` — иначе внутри Telegram тема не сохраняется
- [ ] Бот и веб читают `TELEGRAM_BOT_TOKEN`; `BOT_TOKEN` остаётся запасным именем, чтобы
      не сломать существующий локальный `apps/bot/.env` пользователя
- [ ] Оба `.env.example` перечисляют `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET`,
      `DATABASE_URL`, `CROSS_SITE_COOKIES`, `APP_URL` — **с пустыми значениями**
- [ ] Тест: `sessionCookieOptions()` в обоих режимах переключателя
- [ ] Тест: парность `issueSession` / `clearSession` — обе работают с одним именем куки
- [ ] `npx turbo run test typecheck build format:check --force` зелёный, включая
      12 существующих тестов веба
