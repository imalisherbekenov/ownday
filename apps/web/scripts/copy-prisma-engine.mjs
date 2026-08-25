// Клиент Prisma генерируется в packages/db/generated/client, но transpilePackages
// вбивает его в чанк сборки Next — и рантайм теряет настоящее расположение файла.
// В логе функции видно, где движок ищут на самом деле: apps/web/generated/client.
// Кладём бинарник туда, а next.config подхватывает каталог трассировкой.
// ponytail: копия вместо переезда клиента в node_modules — переезд меняет публичную
// форму @ownday/db и все места импорта; делать его стоит, если копия начнёт врать.
import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const from = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "packages",
  "db",
  "generated",
  "client",
);
const to = path.join(import.meta.dirname, "..", "generated", "client");

const engines = (await readdir(from)).filter((name) => name.endsWith(".node"));
if (engines.length === 0) {
  throw new Error(`Движок Prisma не найден в ${from} — сначала прогони prisma generate`);
}
await mkdir(to, { recursive: true });
for (const name of engines) {
  await cp(path.join(from, name), path.join(to, name));
}
console.log(`движок Prisma скопирован: ${engines.join(", ")} → apps/web/generated/client`);
