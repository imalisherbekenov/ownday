import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
const COOKIE = "habits_session";
const secret = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET ?? "development-only-change-me-32-bytes");
async function signSession(userId: string, expiresIn: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}
export async function issueSession(userId: string) {
  const token = await signSession(userId, "15m");
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 900,
  });
}
export const issueMobileSession = (userId: string) => signSession(userId, "30d");

async function verifySession(token: string | undefined) {
  if (!token) return null;
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
  if (authorization?.startsWith("Bearer ")) return verifySession(authorization.slice(7));
  return readSession();
}
