import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@ownday/db";

const digest = (text: string) => createHash("sha256").update(text).digest("hex");
export const pkceChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");
export const validChallenge = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
const opaque = () => randomBytes(32).toString("base64url");
export const BROWSER_SESSION_SECONDS = 7 * 86400;
export const MOBILE_SESSION_SECONDS = 30 * 86400;

/** Only hashes are stored. Grant claiming and session creation share a transaction. */
export class AuthTokens {
  constructor(
    private db: PrismaClient,
    private clock = () => new Date(),
  ) {}
  private expires(seconds: number) {
    return new Date(this.clock().valueOf() + seconds * 1000);
  }
  async createGrant(purpose: "email" | "mobile", subject: string, challenge?: string) {
    if (purpose === "mobile" && !validChallenge(challenge)) throw new Error("INVALID_CHALLENGE");
    const code = opaque();
    await this.db.authGrant.create({
      data: {
        hash: digest(code),
        purpose,
        subject,
        challenge: challenge ?? null,
        expiresAt: this.expires(purpose === "mobile" ? 60 : 600),
      },
    });
    return code;
  }
  async consumeEmail(code: string) {
    if (!validChallenge(code)) return null;
    const now = this.clock();
    const rows = await this.db.$queryRaw<Array<{ subject: string }>>`
      UPDATE "AuthGrant" SET "consumedAt"=(${now} AT TIME ZONE 'UTC')
      WHERE "hash"=${digest(code)} AND "purpose"='email' AND "consumedAt" IS NULL AND "expiresAt">(${now} AT TIME ZONE 'UTC')
      RETURNING "subject"`;
    return rows[0]?.subject ?? null;
  }
  async createAppleChallenge() {
    const challenge = opaque();
    await this.db.authGrant.create({
      data: {
        hash: digest(challenge),
        purpose: "apple",
        subject: "native",
        expiresAt: this.expires(300),
      },
    });
    return challenge;
  }
  async consumeAppleChallenge(challenge: string) {
    if (!validChallenge(challenge)) return false;
    const result = await this.db.authGrant.updateMany({
      where: {
        hash: digest(challenge),
        purpose: "apple",
        consumedAt: null,
        expiresAt: { gt: this.clock() },
      },
      data: { consumedAt: this.clock() },
    });
    return result.count === 1;
  }
  async exchangeMobile(code: string, verifier: string) {
    if (!validChallenge(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return null;
    const now = this.clock(),
      token = `od1_${opaque()}`;
    return this.db.$transaction(async (tx) => {
      const grants = await tx.$queryRaw<Array<{ subject: string }>>`
        UPDATE "AuthGrant" SET "consumedAt"=(${now} AT TIME ZONE 'UTC')
        WHERE "hash"=${digest(code)} AND "purpose"='mobile' AND "challenge"=${pkceChallenge(verifier)}
          AND "consumedAt" IS NULL AND "expiresAt">(${now} AT TIME ZONE 'UTC') RETURNING "subject"`;
      const grant = grants[0];
      if (!grant) return null;
      const user = await tx.user.findUnique({ where: { id: grant.subject } });
      if (!user) return null;
      const expiresAt = this.expires(MOBILE_SESSION_SECONDS);
      await tx.deviceSession.create({ data: { hash: digest(token), userId: user.id, expiresAt } });
      return { token, userId: user.id, expiresAt: expiresAt.toISOString() };
    });
  }
  async issueSession(userId: string, seconds = BROWSER_SESSION_SECONDS) {
    const token = `od1_${opaque()}`;
    await this.db.deviceSession.create({
      data: { hash: digest(token), userId, expiresAt: this.expires(seconds) },
    });
    return token;
  }
  async verify(token: string, renewSeconds?: number) {
    if (!/^od1_[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const now = this.clock(),
      hash = digest(token);
    if (renewSeconds) {
      const rows = await this.db.$queryRaw<Array<{ userId: string }>>`
        UPDATE "DeviceSession" SET "expiresAt"=(${this.expires(renewSeconds)} AT TIME ZONE 'UTC')
        WHERE "hash"=${hash} AND "revokedAt" IS NULL AND "expiresAt">(${now} AT TIME ZONE 'UTC') RETURNING "userId"`;
      return rows[0]?.userId ?? null;
    }
    const session = await this.db.deviceSession.findFirst({
      where: { hash, revokedAt: null, expiresAt: { gt: now } },
      select: { userId: true },
    });
    return session?.userId ?? null;
  }
  async revoke(token: string) {
    await this.db.deviceSession.updateMany({
      where: { hash: digest(token), revokedAt: null },
      data: { revokedAt: this.clock() },
    });
  }
  async deleteAccount(token: string, expectedUserId: string) {
    if (!/^od1_[A-Za-z0-9_-]{43}$/.test(token)) return false;
    const sessionHash = digest(token),
      userHash = digest(expectedUserId),
      now = this.clock();
    return this.db.$transaction(async (tx) => {
      // Serialize retries even after deleting User and its sessions.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sessionHash},0))::text`;
      const receipt = await tx.accountDeletionReceipt.findUnique({ where: { sessionHash } });
      if (receipt) return receipt.userHash === userHash && receipt.expiresAt > now;
      const session = await tx.deviceSession.findFirst({
        where: {
          hash: sessionHash,
          userId: expectedUserId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      });
      if (!session) return false;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${expectedUserId}::uuid FOR UPDATE`;
      await tx.accountDeletionReceipt.create({
        data: { sessionHash, userHash, expiresAt: this.expires(7 * 86400) },
      });
      await tx.authGrant.deleteMany({ where: { purpose: "mobile", subject: expectedUserId } });
      await tx.user.delete({ where: { id: expectedUserId } });
      return true;
    });
  }
}
