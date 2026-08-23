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
  "updatedAt": "2026-08-23T18:23:29+05:00",
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
      "note": "3 из 4 тасков готовы"
    },
    {
      "id": "review",
      "status": "active",
      "startedAt": "2026-08-23T14:32:35+05:00",
      "note": "проверено 3 из 4"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 15,
    "done": 19,
    "inTicket": 9,
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
      "status": "done",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "startedAt": "2026-08-23T14:14:06+05:00",
      "repairFindings": [
        "ворота недетерминированны: typecheck гонится с build за .next/types — D01",
        "матчер middleware исключает почти все маршруты — R07i недоставлен",
        "clearSession и удаление куки темы без атрибутов — R07i.2 недоставлен в iframe"
      ],
      "finishedAt": "2026-08-23T14:51:09+05:00",
      "commit": "ef43604",
      "tests": {
        "passed": 42,
        "failed": 0
      },
      "files": [
        "apps/web/src/lib/session.ts",
        "apps/web/src/lib/session.test.ts",
        "apps/web/src/middleware.ts",
        "apps/web/src/middleware.test.ts",
        "apps/web/src/app/settings/actions.ts",
        "apps/web/.env.example",
        "apps/bot/src/main.ts",
        "apps/bot/.env.example",
        "turbo.json"
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
      "status": "done",
      "retries": 0,
      "repairs": 3,
      "handoffs": 0,
      "startedAt": "2026-08-23T14:51:09+05:00",
      "repairFindings": [
        "контракт useTelegram сменён, а его потребители были в другой волне — дерево красное, D02",
        "beforeInteractive не доставляет SDK (D03); среда определялась наличием объекта, а не initData (D04)",
        "A01 сломан фиксом по D04: заглушка mockTelegram выключает сама себя (D05)"
      ],
      "finishedAt": "2026-08-23T16:04:44+05:00",
      "commit": "9ad501d",
      "tests": {
        "passed": 50,
        "failed": 0
      },
      "files": [
        "apps/web/src/app/layout.tsx",
        "apps/web/src/components/telegram-provider.tsx",
        "apps/web/src/components/telegram-provider.test.tsx",
        "apps/web/src/app/api/auth/telegram/route.ts",
        "apps/web/src/app/api/auth/telegram/route.test.ts",
        "apps/web/src/components/app-shell.tsx",
        "apps/web/src/components/habit-row-adapter.tsx",
        "apps/web/src/components/primary-action-adapter.tsx"
      ]
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
      "status": "done",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "startedAt": "2026-08-23T14:51:09+05:00",
      "repairFindings": [
        "алиас setupBot сверх границы + не-https APP_URL ронял бота",
        "РЕГРЕССИЯ ремонта: mainMenu перестал читать APP_URL, а handlers.ts зовёт его без довода — кнопка на клавиатуре мертва"
      ],
      "finishedAt": "2026-08-23T15:42:07+05:00",
      "commit": "1abbf00",
      "tests": {
        "passed": 24,
        "failed": 0
      },
      "files": [
        "apps/bot/src/setup.ts",
        "apps/bot/src/setup.test.ts",
        "apps/bot/src/keyboards.ts",
        "apps/bot/src/keyboards.test.ts",
        "apps/bot/src/i18n/ru.ts",
        "apps/bot/src/i18n/en.ts",
        "apps/bot/src/main.ts"
      ]
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
        "R13",
        "G01"
      ],
      "blockedBy": [
        "02"
      ],
      "wave": 3,
      "zone": [
        "apps/web/src/components/",
        "apps/web/src/app/"
      ],
      "status": "repair",
      "retries": 0,
      "repairs": 3,
      "handoffs": 0,
      "startedAt": "2026-08-23T16:04:44+05:00",
      "repairFindings": [
        "заглушка не переживала полную перезагрузку — чек-лист приёмки был непроходим",
        "главная кнопка обычного веба на / изменилась: py-3 вместо py-4, потерян text-lg, button стал ссылкой — R10i",
        "G01: пользователь решил починить мёртвую кнопку Add a habit"
      ]
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 74,
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
    "apps/web/src/middleware.test.ts:6 — тест толкует матчер обычным RegExp, Next компилирует через path-to-regexp; совпадает, пока в шаблоне нет параметров",
    "T03 apps/bot/src/keyboards.ts:19 — чтение process.env.APP_URL в значении параметра по умолчанию не покрыто: оба теста передают адрес явно, стирание чтения окружения оставит их зелёными",
    "T03 apps/bot/src/setup.ts:34 — подпись кнопки меню жёстко из английского словаря, кнопка на клавиатуре по языку человека: два входа расходятся молча",
    "T03 apps/bot/src/setup.ts:39 — два публичных имени у одной функции (setupBot как псевдоним publishBotSetup), читается как два шва",
    "T02 apps/web/src/app/layout.tsx:32-40 — порядок между next/script beforeInteractive и инлайновым читателем не гарантирован соседством; критерий «нет вспышки темы» не подкреплён ни одним наблюдением",
    "T02 apps/web/src/app/layout.tsx:33 + telegram-provider.tsx:106 — установка data-mini-app/data-theme написана дважды",
    "T02 apps/web/src/components/primary-action-adapter.tsx:33 — список зависимостей эффекта сменён с объекта контекста на telegram.webApp: MainButton не переподписывается при смене status. Это поведение, а не приведение вызова по D02",
    "T02 — без единого утверждения: status anonymous, состояние error с retry, поля контракта кроме status, заглушка mockTelegram и её запрет в проде, ветка 401 маршрута, успешный путь маршрута, синхронная установка атрибутов",
    "T03 keyboards.ts:19 + setup.ts:32-40 — правило «не-https APP_URL считается незаданным» реализовано двумя кусками кода и не записано в §13",
    "T03 keyboards.ts:28 — второй параметр mainMenu после ремонта не зовёт никто: ручка без потребителя",
    "T03 setup.ts:42 — английская подпись кнопки меню верна (у setChatMenuButton нет language_code), но ограничение API нигде не названо",
    "T02 telegram-provider.test.tsx:47,63,89 — ветка ожидания события load не исполняется ни разу: все случаи кладут window.Telegram до отрисовки",
    "T02 layout.tsx:36 — флаг telegramSdkLoaded ставится безусловно, при заблокированной сети соврёт",
    "T02 §1 — блокирующий сторонний скрипт с telegram.org теперь в <head> каждой страницы обычного веба: осознанная плата за R08i.2",
    "T02 telegram-provider.test.tsx:48-64 — охраняется только включающая половина guard'а заглушки. Убрать член !initData из условия — все пять тестов останутся зелёными; защитный случай (настоящий Telegram + ?mockTelegram=1 в адресе) не покрыт",
    "T02 telegram-provider.test.tsx:66-82 — запрет заглушки в проде проверен на пустом окружении без window.Telegram, то есть на более лёгком случае, чем боевой",
    "ИНФРАСТРУКТУРА: полный прогон ворот и поднятый dev-сервер несовместимы — сервер держит DLL движка Prisma, @ownday/db#build падает с EPERM. Половина «EPERM» у исполнителей объясняется этим",
    "T02 — ветка guard'а «заглушка запрошена, но клиент настоящий» держится на осмотре: afterEach возвращает URL на /, ни один тест не совмещает ?mockTelegram=1 с непустым initData",
    "T04 ПОКРЫТИЕ: четыре места проверяемы дёшево без браузера, но закрыты от теста — nestedRoutes (предикат не выставлен), ветка history.length<=1 внутри обработчика, калитка isVersionAtLeast('7.7'), правило включения заглушки на трёх входах. Условие: чистая функция/предикат вынесен из эффекта + 1-2 случая",
    "T04 app-shell.tsx:45-52,71-78 — нижняя навигация написана дважды, в WebShell и MiniAppShell, различие только в классах: пункт, добавленный в одну, потеряется в другой",
    "T04 mini-app-back-button.tsx:7 — второй список, знающий структуру маршрутов (первый — items в app-shell). Новый экран требует правки в двух местах; забытая даст экран без «назад»",
    "T04 primary-action-adapter.tsx:19-22,32 — адаптер лезет в разметку чужого пакета селектором button.primary и прячет её императивно, хотя тот же элемент уже скрывается пропом hidden: два механизма на одну кнопку, второй мутирует DOM, которым владеет React",
    "T04 primary-action-adapter.tsx:32 — зависимости эффекта [telegram.webApp,...] осталось и выросло: под ним теперь поиск формы, requestSubmit и возврат кнопки, утверждений нет ни на что, хотя очистка при уходе — названный критерий таска",
    "T04 app-shell.tsx:59-64 — isVersionAtLeast/disableVerticalSwipes дописаны локальным приведением типа мимо TelegramWebApp, которым владеет провайдер",
    "T04 — при перезагрузке с сохранённой заглушкой data-mini-app ставится только после гидратации: под заглушкой вспышка чужой темы возвращается (в настоящем Telegram её нет)",
    "T04 primary-action-adapter.tsx:19-22 — зависимость на класс .primary в разметке @ownday/ui: переименуют класс — внутри Telegram молча появятся две кнопки подтверждения, ни один тест не заметит",
    "T04 заглушка не имеет выключателя — снимается только закрытием вкладки (записано в §14в)",
    "T04 BackButton нельзя подтвердить нажатием: заглушка складывает обработчики в Set и наружу не отдаёт. Условие, если закрывать наблюдением: заглушка даёт способ вызвать зарегистрированные обработчики",
    "T04 положительная ветка disableVerticalSwipes недостижима под заглушкой, потому что isVersionAtLeast/disableVerticalSwipes описаны локальным as-приведением мимо типа провайдера",
    "G01 primary-action.tsx:25 — голый <a> вместо инъекции LinkRenderer, которая уже используется в habit-row.tsx: внутри приложения полная перезагрузка вместо клиентского перехода, в пакете два разных ответа на один вопрос",
    "G01 primary-action.tsx:23 — три роли при молчаливом старшинстве: при href и formId одновременно привязка к форме исчезает без следа, порядок веток нигде не назван",
    "G01 components.test.tsx:94-108 — общность классов не охраняется: сотри className у ветки со ссылкой, оба случая останутся зелёными. Проверено разветвление, а не неразветвлённость вида",
    "G01 components.test.tsx:94 — два случая в одном it, падение первого прячет второй",
    "СТРУКТУРНЫЙ ВЫВОД (craft): formId стал переключателем режима, а не параметром — по нему решаются MainButton, скрытие родной кнопки и доступ к разметке формы. Работает, пока «есть форма» и «главное действие отдано Telegram» совпадают. Разойдутся на экране с MainButton без формы или на форме, где главное действие — ссылка. Правило: намерение выражается выбором компонента, а не наличием formId. Разрез: адаптер требует formId обязательным, главный экран рисует PrimaryAction с href напрямую",
    "G01 components.test.tsx — сам renderLink не покрыт: оба случая идут по запасной ветке с голым <a>, потеря подстановки next/link (возврат к полной перезагрузке) прогон не покрасит"
  ],
  "reviewers": {
    "manifestSpec": "a3dd68d0b12b89e67",
    "craft": "a31a201defad50a0c"
  },
  "blind": null
}
