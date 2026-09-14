import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";
const keys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"), {
  timeoutDuration: 10000,
});
export async function verifyAppleIdentity(
  token: string,
  nonce: string,
  audience: string,
  key: JWTVerifyGetKey = keys,
) {
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["RS256"],
    issuer: "https://appleid.apple.com",
    audience,
    maxTokenAge: "10m",
  });
  if (
    payload.nonce !== nonce ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    typeof payload.exp !== "number"
  )
    throw new Error("INVALID_APPLE_IDENTITY");
  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : undefined,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}
