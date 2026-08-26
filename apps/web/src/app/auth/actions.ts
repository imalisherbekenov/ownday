"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureDemoData, repositories } from "@/lib/services";
import { issueSession } from "@/lib/session";
import { SignJWT, jwtVerify } from "jose";
import { createMagicLinkSender } from "@/lib/magic-link";
import { withinLimit } from "@/lib/rate-limit";
const WINDOW_MS = 15 * 60 * 1000;
// Токен входа наружу не возвращается ни в каком виде: он равен сессии, а единственный
// сторож у него — почтовый ящик. Обратно едет только «получилось» или причина отказа.
export type MagicLinkState = { error?: string; ok?: boolean };
const key = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET ?? "development-only-change-me-32-bytes");
export async function requestMagicLink(_previousState: MagicLinkState, formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) return { error: "Введите корректный адрес почты." };
  // Эта форма никого не спрашивает, кто он, и отправляет письмо с нашего домена на
  // любой названный адрес. Без потолка это чужой счёт в Resend, испорченная
  // репутация отправителя и способ засыпать человека письмами от нашего имени.
  // Адрес и источник считаются порознь: один перебирает адреса, другой долбит свой.
  const source = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!withinLimit(`email:${email}`, 3, WINDOW_MS) || !withinLimit(`ip:${source}`, 10, WINDOW_MS))
    return { error: "Слишком много попыток. Попробуйте через несколько минут." };
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(key());
  await createMagicLinkSender().send({
    email,
    url: `${process.env.APP_URL ?? "http://localhost:3000"}/auth/verify?token=${token}`,
  });
  return { ok: true };
}
export async function completeMagicLink(token: string) {
  const email = await emailFromMagicLink(token);
  if (!email) redirect("/auth/login?error=link");
  let found = await repositories.users.findIdentity("email", email);
  if (!found) {
    await ensureDemoData();
    found = await repositories.users.findIdentity("email", email);
    if (!found) {
      const user = await repositories.users.createWithIdentity({
        provider: "email",
        externalId: email,
        timezone: "UTC",
        dayStartHour: 4,
        locale: "en",
      });
      found = { user, identity: (await repositories.users.findIdentityForUser(user.id, "email"))! };
    }
  }
  await issueSession(found.user.id);
  redirect("/");
}

// Ссылка на вход подписана тем же секретом, что и сессия, и различает их только
// содержимое. Сессионный токен, поднесённый сюда, дал бы payload без почты, а
// String(undefined) завёл бы общий аккаунт с адресом "undefined" — по одному на
// каждого, кто это проделал. Здесь принимается только токен с настоящей почтой,
// протухший и подделанный уходят на страницу входа, а не в 500.
async function emailFromMagicLink(token: string) {
  try {
    const { payload } = await jwtVerify(token, key());
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}
