# Habit tracker

A Node 22, pnpm, Turborepo monorepo. Shared code lives in `packages/`: `core` contains pure domain logic, `tokens` generates design tokens from `docs/design.md`, and `db` owns the Prisma schema and client. Future deployable applications belong in `apps/`.

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

Put framework-independent behavior in `packages/core`, styling values in the frontmatter of `docs/design.md`, persistence changes in `packages/db/prisma/schema.prisma`, and future application entry points under `apps/<name>`.

