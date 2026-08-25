import { randomBytes } from "node:crypto";
import { issueOAuthTransaction } from "@/lib/session";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL;
  if (!clientId || !appUrl)
    return new Response("Google authorization is not configured", { status: 500 });
  // Часовой пояс решает, какой день считается сегодня, а сервер его знать не может:
  // Google обратно ничего такого не отдаёт. Браузер называет его на странице входа,
  // и он едет вместе с state и nonce. Непроверенный пояс уронил бы отрисовку —
  // localDateFor зовёт с ним Intl на каждый расчёт.
  const timezone = validTimezone(new URL(request.url).searchParams.get("tz"));
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  await issueOAuthTransaction(state, nonce, timezone);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    access_type: "online",
    prompt: "select_account",
  }).toString();
  return Response.redirect(url);
}

function validTimezone(value: string | null): string {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}
