import "server-only";

/**
 * Скользящее окно в памяти процесса.
 *
 * Потолок назван прямо: счёт живёт внутри одного инстанса функции. Vercel держит
 * их несколько, и распределённый перебор часть попыток пронесёт. Этого хватает
 * против того, что случается на деле, — цикла по одной форме из одного браузера,
 * — и не стоит ни таблицы, ни миграции, ни зависимости. Понадобится настоящий
 * общий счёт — он живёт либо в таблице, либо в правилах Vercel Firewall.
 */
const windows = new Map<string, number[]>();

export function withinLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const fresh = (windows.get(key) ?? []).filter((at) => now - at < windowMs);
  const allowed = fresh.length < limit;
  if (allowed) fresh.push(now);
  windows.set(key, fresh);
  // Ключи копятся от каждого нового адреса, поэтому раз в несколько тысяч записей
  // выметаются те, у которых окно уже целиком в прошлом.
  if (windows.size > 5_000)
    for (const [key, hits] of windows)
      if (!hits.some((at) => now - at < windowMs)) windows.delete(key);
  return allowed;
}

export function resetLimits() {
  windows.clear();
}
