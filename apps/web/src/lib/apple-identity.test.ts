// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyAppleIdentity } from "./apple-identity";
let privateKey: CryptoKey, key: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  key = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: "test", alg: "RS256" }],
  });
});
async function token(
  nonce = "nonce",
  audience = "app.ownday.mobile",
  issuer = "https://appleid.apple.com",
  expires = "5m",
) {
  return new SignJWT({ nonce, email: "Private@privaterelay.appleid.com", email_verified: "true" })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setSubject("apple-user")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(privateKey);
}
describe("Apple identity verification", () => {
  it("verifies the signature and normalizes Apple's verified email claim", async () => {
    expect(await verifyAppleIdentity(await token(), "nonce", "app.ownday.mobile", key)).toEqual({
      sub: "apple-user",
      email: "private@privaterelay.appleid.com",
      emailVerified: true,
    });
  });
  it.each(["nonce", "audience", "issuer", "expiry"])("rejects the wrong %s", async (mode) => {
    const jwt = await token(
      "nonce",
      mode === "audience" ? "another.app" : "app.ownday.mobile",
      mode === "issuer" ? "https://other.invalid" : "https://appleid.apple.com",
      mode === "expiry" ? "-1m" : "5m",
    );
    await expect(
      verifyAppleIdentity(jwt, mode === "nonce" ? "other" : "nonce", "app.ownday.mobile", key),
    ).rejects.toThrow();
  });
});
