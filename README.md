# Ownday

A habit tracker across three surfaces — a Telegram bot, the web, and a Telegram
Mini App — sharing one domain core and one design system.

## Layout

```
apps/
  bot/        Telegram bot (grammY): commands, habit wizard, reminder worker
  web/        Next.js App Router: the web app and the Telegram Mini App
packages/
  core/       pure domain logic — day boundaries, schedules, streaks. No I/O
  services/   application layer over repository interfaces (Prisma + in-memory)
  db/         Prisma schema and client
  tokens/     design tokens generated from docs/design.md
docs/
  design.md          the design system — single source of truth for tokens
  design.stitch.md   the same system in Stitch's format, for uploading
  screens/           reference screens, mobile
  screens-desktop/   reference screens, desktop
```

## Commands

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm format:check
```

Run the web app on its own:

```sh
pnpm --filter @ownday/web dev
```

Without `DATABASE_URL` the web app falls back to in-memory repositories seeded
with demo data, so it runs with no database. That fallback is refused in
production.

## Where things belong

- **Framework-independent behaviour** goes in `packages/core`. Dates, schedules,
  streaks and completion rates live there and nowhere else — the bot, the web
  app and any future client must all get the same answer.
- **Application operations** go in `packages/services`, defined against
  repository interfaces so they can be tested without a database.
- **Styling values** go in the frontmatter of `docs/design.md`. `packages/tokens`
  generates CSS variables, a typed TS object and JSON from it. No colour literal
  belongs anywhere else.
- **Persistence changes** go in `packages/db/prisma/schema.prisma`.

## Rules worth knowing before changing the UI

Two accent colours exist and each means one thing: green is completion, saffron
is streak. A habit's own colour is user data, not an accent — it tints the habit
icon and its line on comparison charts, never a checkbox or a streak pill.

A streak pill is saffron only at 7 days or more, neutral below that, and absent
entirely at zero.

Marking a day `skip` is a deliberate freeze. It does not break a streak and is
excluded from the completion percentage. Without it the tracker punishes people
for holidays and illness, and they abandon it.

The full set of rules is in `docs/design.md`.
