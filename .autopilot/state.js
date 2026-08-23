window.STATE =
{
  "slug": "telegram-mini-app",
  "dir": "2026-08-23-telegram-mini-app--wip",
  "title": "Живой Mini App внутри Telegram",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-08-23-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "C:/Users/Administrator/.claude/skills/autopilot",
  "startedAt": "2026-08-23T13:48:13+05:00",
  "updatedAt": "2026-08-23T14:49:43+05:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-08-23T13:48:13+05:00",
      "finishedAt": "2026-08-23T13:50:11+05:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-08-23T13:50:11+05:00",
      "finishedAt": "2026-08-23T13:53:07+05:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-08-23T13:53:07+05:00",
      "finishedAt": "2026-08-23T13:58:36+05:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-08-23T13:58:36+05:00",
      "finishedAt": "2026-08-23T14:05:33+05:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-08-23T14:05:33+05:00",
      "note": "4 таска, ярус T2",
      "finishedAt": "2026-08-23T14:09:28+05:00"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-08-23T14:09:28+05:00",
      "note": "0 из 4 тасков готовы"
    },
    {
      "id": "review",
      "status": "active",
      "startedAt": "2026-08-23T14:32:35+05:00",
      "note": "таск 01 на ревью"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 14,
    "done": 0,
    "inTicket": 13,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 1,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Сессия, куки и единое имя токена",
      "requirements": [
        "R07i",
        "R07i.1",
        "R07i.2",
        "R02"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "apps/web/src/lib/",
        "apps/web/src/middleware.ts",
        "apps/web/src/app/settings/",
        "apps/bot/src/main.ts"
      ],
      "status": "repair",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "startedAt": "2026-08-23T14:14:06+05:00",
      "repairFindings": [
        "ворота недетерминированны: typecheck гонится с build за .next/types — D01",
        "матчер middleware исключает почти все маршруты — R07i недоставлен",
        "clearSession и удаление куки темы без атрибутов — R07i.2 недоставлен в iframe"
      ]
    },
    {
      "id": "02",
      "title": "SDK, светлота и вход по Telegram",
      "requirements": [
        "R01",
        "R01.1",
        "R01.2",
        "R01.3",
        "R05i",
        "R05i.1",
        "R08i",
        "R08i.1",
        "R08i.2",
        "R09i.1",
        "R11i",
        "A01"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "apps/web/src/app/layout.tsx",
        "apps/web/src/components/telegram-provider.tsx",
        "apps/web/src/app/api/auth/telegram/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "03",
      "title": "Вход в приложение из бота",
      "requirements": [
        "R04i",
        "R04i.1",
        "R03"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "apps/bot/src/setup.ts",
        "apps/bot/src/keyboards.ts",
        "apps/bot/src/i18n/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "04",
      "title": "Оболочка Mini App: навигация и родные кнопки",
      "requirements": [
        "R06i",
        "R06i.1",
        "R06i.2",
        "R06i.3",
        "R09i",
        "R10i",
        "R12",
        "R12.1",
        "R13"
      ],
      "blockedBy": [
        "02"
      ],
      "wave": 3,
      "zone": [
        "apps/web/src/components/",
        "apps/web/src/app/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 42,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "findings": 3,
    "fixed": 3,
    "note": "haptic и MainButton — потерянные требования, вернулись как R13 и R12; 'четыре поверхности' раскрыты в §17"
  },
  "concerns": [
    "apps/web/src/lib/session.ts:34-42,80-88 — блок записи куки продублирован в issueSession и refreshSessionCookie",
    "apps/web/src/lib/session.ts — имя sessionCookieOptions() обещает сессию, а одевает все куки приложения",
    "apps/web/src/middleware.ts:10-12 — Set-Cookie на каждом ответе делает страницы непригодными для общего кэша",
    "apps/web/src/lib/session.ts:80 — булев результат refreshSessionCookie в проде никто не читает",
    "apps/web/src/lib/session.test.ts — срок внутри JWT не покрыт ассертом, только maxAge куки",
    "apps/bot/.env.example — перечисляет SESSION_SECRET и CROSS_SITE_COOKIES, которых бот не читает (дефект критерия таска, не исполнителя)",
    "apps/bot/src/main.ts:8-10 — текст ошибки называет одно имя переменной, код принимает два",
    "turbo.json — правка вне зоны таска 01; оправдана D01, но пришла попутно с волной 1",
    "apps/web/src/lib/session.test.ts:157 — парность очистки сверяется с рукописным литералом на три атрибута; httpOnly утверждён только на выдаче",
    "apps/web/src/lib/session.test.ts:163 — продление покрыто только при CROSS_SITE_COOKIES=1; захардкоженный sameSite внутри refreshSessionCookie оставит прогон зелёным",
    "apps/web/src/app/settings/actions.ts:16 — парность куки темы не наблюдается ни одним тестом, держится на чтении глазами",
    "apps/web/src/middleware.test.ts:6 — тест толкует матчер обычным RegExp, Next компилирует через path-to-regexp; совпадает, пока в шаблоне нет параметров"
  ],
  "reviewers": {
    "manifestSpec": "a3dd68d0b12b89e67",
    "craft": "a31a201defad50a0c"
  },
  "blind": null
}
