"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { repositories } from "@/lib/services";
import { issueSession } from "@/lib/session";
import { createMagicLinkSender } from "@/lib/magic-link";
import { withinLimit } from "@/lib/rate-limit";
import { authTokens } from "@/lib/auth-tokens";
import { loginDestination } from "@/lib/login-destination";
import { interfaceLocale } from "@/lib/interface-locale";
const WINDOW_MS = 15 * 60 * 1000;
// The form returns delivery status; the one-time code goes only to the mailbox.
export type MagicLinkState = { error?: string; ok?: boolean };
export async function requestMagicLink(_previousState: MagicLinkState, formData: FormData) {
  const locale = await interfaceLocale(),
    t = (ru: string, en: string) => (locale === "ru" ? ru : en);
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@"))
    return { error: t("Введите корректный адрес почты.", "Enter a valid email address.") };
  // Эта форма никого не спрашивает, кто он, и отправляет письмо с нашего домена на
  // любой названный адрес. Без потолка это чужой счёт в Resend, испорченная
  // репутация отправителя и способ засыпать человека письмами от нашего имени.
  // Адрес и источник считаются порознь: один перебирает адреса, другой долбит свой.
  const source = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (
    !(await withinLimit(`email:${email}`, 3, WINDOW_MS)) ||
    !(await withinLimit(`ip:${source}`, 10, WINDOW_MS))
  )
    return {
      error: t(
        "Слишком много попыток. Попробуйте через несколько минут.",
        "Too many attempts. Please try again in a few minutes.",
      ),
    };
  // Resend отказывает по причинам, которых мы не знаем заранее: неподтверждённый
  // домен отправителя, исчерпанная квота, лежащий сервис. Непойманный отказ в
  // серверном действии — это экран ошибки вместо страницы входа, то есть сломанный
  // вход вместо не отправленного письма. Причина уходит в лог, человеку остаётся
  // дверь, которая точно работает.
  try {
    const token = await authTokens().createGrant("email", email);
    await createMagicLinkSender().send({
      email,
      url: `${process.env.APP_URL ?? "http://localhost:3000"}/auth/verify?token=${token}`,
    });
  } catch (cause) {
    console.error("magic link: delivery failed", cause);
    return {
      error: t(
        "Письмо не отправилось. Попробуйте войти через Google.",
        "The email could not be sent. Try signing in with Google.",
      ),
    };
  }
  return { ok: true };
}
export async function completeMagicLink(token: string) {
  const email = await emailFromMagicLink(token);
  if (!email) redirect("/auth/login?error=link");
  let found = await repositories.users.findIdentity("email", email);
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
  await issueSession(found.user.id);
  redirect(await loginDestination());
}

// Purpose and expiry are checked while the database atomically claims the code.
async function emailFromMagicLink(token: string) {
  try {
    const email = (await authTokens().consumeEmail(token)) ?? "";
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}
