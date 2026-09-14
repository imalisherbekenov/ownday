# Ownday Design Lab

Three interactive design concepts for choosing the direction of Ownday. This is
an isolated browser prototype, not the production mobile app or a cloud service.

**Selected direction: C / Living journal.** Chosen by the user on 13 September 2026.
New browser sessions default to C; existing demo preferences and data are preserved.
A and B remain available as comparison references. See
[the implementation specification](../../docs/ownday-implementation.md).

## Run

From the repository root, with Node 22.12+:

```sh
pnpm install --frozen-lockfile
pnpm design:dev
```

Open http://127.0.0.1:4310. If the package-manager launcher is unavailable but the
dependencies are already installed, use `node apps/design-lab/dev.mjs`.

```sh
pnpm --filter @ownday/design-lab build
pnpm --filter @ownday/design-lab test
pnpm --filter @ownday/design-lab typecheck
```

## Compare

- **A / Warm minimalism:** paper surfaces, quiet list, side navigation.
- **B / Precision tool:** horizontal navigation, compact rows and numerical emphasis.
- **C / Living journal:** editorial typography, botanical drawing, morning/afternoon/evening chapters.

The top bar switches concepts without changing the current screen, selected day
or data. It also switches Russian/English, light/dark appearance and five scenarios.
Each scenario has its own persisted dataset so experiments in one do not wipe
another. The reset button restores all sample datasets and the everyday scenario,
while retaining the chosen language, appearance and concept.

Try the counters, completion/undo, intentional skips, calendar, habit detail,
week/month statistics, templates and creation form. The Product website button
opens the matching landing page. Its calls to action return to the working demo;
there are no fake store links, login, subscriptions or downloads.

The demonstration date is **13 September 2026**. New habits begin on that date.
Past dates can be reviewed and edited; future and unscheduled dates are disabled.
The duration control records minutes in five-minute steps; it is not a running timer.
User-entered names are kept as entered when the interface language changes.

## Isolation and limitations

Data lives only in `localStorage` under `ownday.design-lab.v1`. The offline/error
scenarios simulate the interface: there is no synchronization API, production DB,
analytics SDK, Telegram SDK or service worker. The app bundles its fonts locally.
If storage is unavailable, the demo remains usable in memory with a visible notice.
Clearing browser data deletes demo edits.

`src/model.ts` is a small prototype model, not a replacement for `@ownday/core`.
It demonstrates reversible entries and correct scheduled denominators for the
included scenarios. Production timezone handling, sync conflicts, schedule
versioning, native persistence and migrations remain later work.

The concept tokens in `src/styles.css` are intentionally separate from
`docs/design.md`; moving the selected C tokens into production is a separate implementation step.

## Fonts

Nunito and Nunito Sans Latin/Cyrillic WOFF2 subsets were copied unchanged from the
existing Next.js font assets in this workspace. They are self-hosted so the demo
does not call Google Fonts. The upstream SIL Open Font Licenses are included in
`public/fonts/Nunito-OFL.txt` and `public/fonts/NunitoSans-OFL.txt`.

Sources: https://github.com/google/fonts/tree/main/ofl/nunito and
https://github.com/google/fonts/tree/main/ofl/nunitosans.
