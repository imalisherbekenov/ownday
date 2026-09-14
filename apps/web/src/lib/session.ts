import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { sessionSecret } from "./config";
import { authTokens } from "./auth-tokens";
const COOKIE = "habits_session";
// A session lasts a week and slides forward on activity: a reminder sent in the
// evening is often opened the next morning, and that must not log anyone out.
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_TTL_SECONDS = 5 * 60;
const OAUTH_STATE_COOKIE = "habits_oauth_state";
const OAUTH_NONCE_COOKIE = "habits_oauth_nonce";
const OAUTH_TZ_COOKIE = "habits_oauth_tz";
const secret = sessionSecret;

type SessionCookieOptions = { sameSite: "lax" | "none"; secure: boolean; path: string };

/**
 * Cross-site attributes for every cookie this app has to survive the Telegram
 * iframe. `SameSite=Lax` is simply not sent there, but `None` outside Telegram
 * weakens the site for no reason — so the switch is a deployment decision
 * (`CROSS_SITE_COOKIES`), not a build mode (`NODE_ENV`).
 */
export function sessionCookieOptions(): SessionCookieOptions {
  if (process.env.CROSS_SITE_COOKIES === "1") return { sameSite: "none", secure: true, path: "/" };
  return { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" };
}

async function signSession(userId: string, expiresIn: string) {
  if (process.env.DATABASE_URL) return authTokens().issueSession(userId, SESSION_TTL_SECONDS);
  if (process.env.NODE_ENV === "production")
    throw new Error("DATABASE_URL is required for sessions");
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}
export async function issueSession(userId: string) {
  const token = await signSession(userId, `${SESSION_TTL_SECONDS}s`);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    ...sessionCookieOptions(),
    maxAge: SESSION_TTL_SECONDS,
  });
}
export async function clearSession() {
  const current = (await cookies()).get(COOKIE)?.value;
  if (current?.startsWith("od1_") && process.env.DATABASE_URL) await authTokens().revoke(current);
  // Deleting a cookie is itself a Set-Cookie write: from the Telegram iframe the
  // browser drops it unless it carries the very attributes it was set with, and a
  // dropped deletion means deleting the account does not sign anyone out.
  (await cookies()).set(COOKIE, "", {
    httpOnly: true,
    ...sessionCookieOptions(),
    maxAge: 0,
  });
}
export async function issueOAuthTransaction(state: string, nonce: string, timezone: string) {
  const jar = await cookies();
  const options = { httpOnly: true, ...sessionCookieOptions(), maxAge: OAUTH_TTL_SECONDS };
  jar.set(OAUTH_STATE_COOKIE, state, options);
  jar.set(OAUTH_NONCE_COOKIE, nonce, options);
  jar.set(OAUTH_TZ_COOKIE, timezone, options);
}
export async function readOAuthTransaction() {
  const jar = await cookies();
  return {
    state: jar.get(OAUTH_STATE_COOKIE)?.value,
    nonce: jar.get(OAUTH_NONCE_COOKIE)?.value,
    timezone: jar.get(OAUTH_TZ_COOKIE)?.value,
  };
}
export async function clearOAuthTransaction() {
  const jar = await cookies();
  const options = { httpOnly: true, ...sessionCookieOptions(), maxAge: 0 };
  jar.set(OAUTH_STATE_COOKIE, "", options);
  jar.set(OAUTH_NONCE_COOKIE, "", options);
  jar.set(OAUTH_TZ_COOKIE, "", options);
}
async function verifySession(token: string | undefined) {
  if (!token) return null;
  if (token.startsWith("od1_")) return process.env.DATABASE_URL ? authTokens().verify(token) : null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function readSession() {
  return verifySession((await cookies()).get(COOKIE)?.value);
}

export async function readSessionFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    return token.startsWith("od1_") && process.env.DATABASE_URL ? authTokens().verify(token) : null;
  }
  return readSession();
}

type RequestCookies = { get(name: string): { value: string } | undefined };
type ResponseCookies = {
  set(
    name: string,
    value: string,
    options: SessionCookieOptions & Record<string, unknown>,
  ): unknown;
};

/**
 * Slides a live session forward. Structural cookie jars instead of Next types so
 * this stays usable from middleware (Server Components cannot set cookies, which
 * is why the renewal lives there at all). Returns false — and writes nothing —
 * when there is no valid session: middleware renews, it never signs anyone in.
 */
export async function refreshSessionCookie(
  requestCookies: RequestCookies,
  responseCookies: ResponseCookies,
): Promise<boolean> {
  const existing = requestCookies.get(COOKIE)?.value;
  const userId =
    existing?.startsWith("od1_") && process.env.DATABASE_URL
      ? await authTokens().verify(existing, SESSION_TTL_SECONDS)
      : await verifySession(existing);
  if (!userId) return false;
  responseCookies.set(
    COOKIE,
    existing?.startsWith("od1_") ? existing : await signSession(userId, `${SESSION_TTL_SECONDS}s`),
    {
      httpOnly: true,
      ...sessionCookieOptions(),
      maxAge: SESSION_TTL_SECONDS,
    },
  );
  return true;
}
