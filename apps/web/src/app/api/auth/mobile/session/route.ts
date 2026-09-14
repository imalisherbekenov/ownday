import { cookies } from "next/headers";
import { readSession, sessionCookieOptions } from "@/lib/session";
import { authTokens } from "@/lib/auth-tokens";
import { validChallenge } from "@ownday/services";
import { withinLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url),
    challenge = url.searchParams.get("challenge"),
    state = url.searchParams.get("state");
  if (!validChallenge(challenge) || !validChallenge(state))
    return new Response("Invalid authorization request", { status: 400 });
  const userId = await readSession();
  if (!userId) {
    (await cookies()).set("ownday_mobile_login", JSON.stringify({ challenge, state }), {
      httpOnly: true,
      ...sessionCookieOptions(),
      maxAge: 600,
    });
    return Response.redirect(new URL("/auth/login", url));
  }
  if (!(await withinLimit(`mobile-grant:${userId}`, 10, 60000)))
    return new Response("Too many attempts", { status: 429 });
  const code = await authTokens().createGrant("mobile", userId, challenge);
  const callback = new URL("ownday://auth/callback");
  callback.search = new URLSearchParams({ code, state }).toString();
  return new Response(null, {
    status: 302,
    headers: {
      Location: callback.toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
