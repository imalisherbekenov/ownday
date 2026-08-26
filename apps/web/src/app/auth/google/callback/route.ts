import { createRemoteJWKSet, jwtVerify } from "jose";
import { services } from "@/lib/services";
import { clearOAuthTransaction, issueSession, readOAuthTransaction } from "@/lib/session";

export const runtime = "nodejs";
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;
  // Недонастройка — единственное, в чём человек не виноват и ничего не исправит:
  // только она отвечает голым текстом. Всё остальное возвращает на страницу входа,
  // где есть кнопка и форма, а не в тупик с трёхзначным числом. Отказ на стороне
  // Google — это чаще всего нажатие «Отмена», и извиняться за него не за что.
  if (!clientId || !clientSecret || !appUrl)
    return new Response("Google authorization is not configured", { status: 500 });
  const backToLogin = (reason?: string) =>
    Response.redirect(new URL(reason ? `/auth/login?error=${reason}` : "/auth/login", appUrl));
  const returnedState = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const transaction = await readOAuthTransaction();
  await clearOAuthTransaction();
  if (url.searchParams.get("error")) return backToLogin();
  if (!returnedState || !transaction.state || returnedState !== transaction.state)
    return backToLogin("state");
  if (!code || !transaction.nonce) return backToLogin("google");
  let identity: { sub: string; email?: string | undefined; emailVerified: boolean };
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) throw new Error("TOKEN_EXCHANGE_FAILED");
    const tokens = (await tokenResponse.json()) as { id_token?: unknown };
    if (typeof tokens.id_token !== "string") throw new Error("ID_TOKEN_MISSING");
    const { payload } = await jwtVerify(tokens.id_token, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    });
    if (payload.nonce !== transaction.nonce || typeof payload.sub !== "string")
      throw new Error("INVALID_ID_TOKEN");
    identity = {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : undefined,
      emailVerified: payload.email_verified === true,
    };
  } catch {
    return backToLogin("google");
  }
  try {
    const account = await services.ensureUserFromOAuth({
      provider: "google",
      externalId: identity.sub,
      email: identity.email,
      emailVerified: identity.emailVerified,
      timezone: transaction.timezone ?? "UTC",
      locale: request.headers.get("accept-language")?.toLowerCase().startsWith("ru") ? "ru" : "en",
    });
    await issueSession(account.id);
    return Response.redirect(new URL("/", appUrl));
  } catch (cause) {
    console.error("google auth: identity valid, session not issued", cause);
    return backToLogin("google");
  }
}
