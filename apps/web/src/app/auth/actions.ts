"use server";
import { redirect } from "next/navigation";
import { ensureDemoData, repositories } from "@/lib/services";
import { issueSession } from "@/lib/session";
import { SignJWT, jwtVerify } from "jose";
import { StubMagicLinkSender } from "@/lib/magic-link";
const key = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET ?? "development-only-change-me-32-bytes");
export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) return { error: "Enter a valid email" };
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(key());
  await new StubMagicLinkSender().send({
    email,
    url: `${process.env.APP_URL ?? "http://localhost:3000"}/auth/verify?token=${token}`,
  });
  return { ok: true, token: process.env.NODE_ENV === "production" ? undefined : token };
}
export async function completeMagicLink(token: string) {
  const { payload } = await jwtVerify(token, key());
  const email = String(payload.email);
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
