import { authTokens } from "@/lib/auth-tokens";
import { verifyAppleIdentity } from "@/lib/apple-identity";
import { boundedJson } from "@/lib/bounded-json";
import { withinLimit } from "@/lib/rate-limit";
import { services } from "@/lib/services";
import { MOBILE_SESSION_SECONDS } from "@ownday/services";
import { observeRequest } from "@/lib/observe-request";
export const runtime = "nodejs";
async function exchange(request: Request) {
  const audience = process.env.APPLE_NATIVE_CLIENT_ID;
  if (!audience) return Response.json({ error: "APPLE_NOT_CONFIGURED" }, { status: 503 });
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinLimit(`apple-exchange:${address}`, 20, 60000)))
    return new Response(null, { status: 429 });
  try {
    const body = (await boundedJson(request, 16384)) as {
      identityToken?: unknown;
      nonce?: unknown;
      timezone?: unknown;
      locale?: unknown;
    };
    if (
      typeof body.identityToken !== "string" ||
      typeof body.nonce !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(body.nonce)
    )
      return new Response(null, { status: 400 });
    const identity = await verifyAppleIdentity(body.identityToken, body.nonce, audience);
    if (!(await authTokens().consumeAppleChallenge(body.nonce)))
      return Response.json({ error: "INVALID_GRANT" }, { status: 401 });
    let timezone = typeof body.timezone === "string" ? body.timezone : "UTC";
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    } catch {
      timezone = "UTC";
    }
    const user = await services.ensureUserFromOAuth({
      provider: "apple",
      externalId: identity.sub,
      email: identity.email,
      emailVerified: identity.emailVerified,
      timezone,
      locale: body.locale === "ru" ? "ru" : "en",
    });
    const token = await authTokens().issueSession(user.id, MOBILE_SESSION_SECONDS);
    return Response.json(
      {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + MOBILE_SESSION_SECONDS * 1000).toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "APPLE_SIGN_IN_FAILED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export async function POST(request: Request) {
  return observeRequest("auth.apple", () => exchange(request));
}
