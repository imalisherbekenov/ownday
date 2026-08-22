import { createHmac, timingSafeEqual } from "node:crypto";
export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  now = new Date(),
  maxAgeSeconds = 300,
): TelegramUser {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("INVALID_INIT_DATA");
  params.delete("hash");
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Math.abs(now.getTime() / 1000 - authDate) > maxAgeSeconds)
    throw new Error("EXPIRED_INIT_DATA");
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const key = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", key).update(check).digest();
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("INVALID_INIT_DATA");
  const raw = params.get("user");
  if (!raw) throw new Error("INVALID_INIT_DATA");
  return JSON.parse(raw) as TelegramUser;
}
