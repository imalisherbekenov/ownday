import path from "node:path";
import type { NextConfig } from "next";
const root = path.join(import.meta.dirname, "..", "..");
const config: NextConfig = {
  transpilePackages: ["@ownday/core", "@ownday/db", "@ownday/services", "@ownday/tokens"],
  serverExternalPackages: ["@prisma/client"],
  // Клиент Prisma генерируется в packages/db/generated/client — вне node_modules и вне
  // сборщика (serverExternalPackages). Трассировщик Next до бинарника движка сам не
  // доходит, и функция падает с exit 128 на loadEngine. Корень трассировки поднимаем
  // до корня воркспейса, движок включаем явно.
  outputFileTracingRoot: root,
  outputFileTracingIncludes: {
    "/**": ["./generated/client/**"],
  },
  // Значок dev-режима Next по умолчанию стоит внизу слева — там же, где первый пункт
  // нижней навигации. В продакшене его нет вовсе, но пока смотришь приложение на
  // узком экране локально, он закрывает «Сегодня» и мешает поверить своим глазам.
  devIndicators: { position: "top-right" },
};
export default config;
