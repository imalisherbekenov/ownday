import { afterAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@ownday/db";
import { AuthTokens, pkceChallenge } from "./auth-tokens.js";
const url = process.env.TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !target.pathname.startsWith("/ownday_test")
  )
    throw new Error("Dedicated local test database required");
}
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const owners: string[] = [],
  subjects: string[] = [];
const now = new Date("2026-09-13T12:00:00Z");
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
async function setup() {
  const user = await db!.user.create({ data: { timezone: "UTC", locale: "en" } });
  owners.push(user.id);
  subjects.push(user.id);
  return { user, tokens: new AuthTokens(db!, () => now) };
}
describe.skipIf(!db)("one-time authentication on PostgreSQL", () => {
  it("deletes only the authenticated account and confirms a lost deletion response without retaining its data", async () => {
    const { tokens, user } = await setup(),
      other = await setup();
    const token = await tokens.issueSession(user.id),
      second = await tokens.issueSession(user.id);
    try {
      expect(await tokens.deleteAccount(token, other.user.id)).toBe(false);
      await db!.habit.create({
        data: {
          userId: user.id,
          title: "Private fixture",
          icon: "leaf",
          color: "moss",
          category: "test",
          type: "binary",
        },
      });
      expect(await tokens.deleteAccount(token, user.id)).toBe(true);
      expect(await tokens.verify(second)).toBeNull();
      expect(await db!.habit.count({ where: { userId: user.id } })).toBe(0);
      expect(await db!.user.findUnique({ where: { id: other.user.id } })).not.toBeNull();
      expect(await tokens.deleteAccount(token, user.id)).toBe(true);
      expect(await tokens.deleteAccount(token, other.user.id)).toBe(false);
      const receipt = await db!.accountDeletionReceipt.findUniqueOrThrow({
        where: { sessionHash: hash(token) },
      });
      expect(JSON.stringify(receipt)).not.toContain(user.id);
      expect(
        await new AuthTokens(db!, () => new Date(now.valueOf() + 8 * 86400000)).deleteAccount(
          token,
          user.id,
        ),
      ).toBe(false);
    } finally {
      await db!.accountDeletionReceipt.deleteMany({ where: { sessionHash: hash(token) } });
    }
  });
  it("claims an Apple nonce only once and rejects expired or wrong-purpose challenges", async () => {
    const { tokens } = await setup();
    const nonce = await tokens.createAppleChallenge(),
      expired = await tokens.createAppleChallenge();
    try {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => tokens.consumeAppleChallenge(nonce)),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await tokens.consumeEmail(nonce)).toBeNull();
      const later = new AuthTokens(db!, () => new Date(now.valueOf() + 301000));
      expect(await later.consumeAppleChallenge(expired)).toBe(false);
    } finally {
      await db!.authGrant.deleteMany({ where: { hash: { in: [hash(nonce), hash(expired)] } } });
    }
  });
  it("binds code exchange to the verifier and permits only one concurrent redemption", async () => {
    const { user, tokens } = await setup(),
      verifier = randomBytes(32).toString("base64url");
    const code = await tokens.createGrant("mobile", user.id, pkceChallenge(verifier));
    expect(await tokens.exchangeMobile(code, randomBytes(32).toString("base64url"))).toBeNull();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => tokens.exchangeMobile(code, verifier)),
    );
    const accepted = results.filter((result) => result !== null);
    expect(accepted).toHaveLength(1);
    const token = accepted[0]!.token;
    expect(await tokens.verify(token)).toBe(user.id);
    expect(await db!.deviceSession.findUnique({ where: { hash: token } })).toBeNull();
    expect(await db!.deviceSession.findUnique({ where: { hash: hash(token) } })).not.toBeNull();
    await tokens.revoke(token);
    expect(await tokens.verify(token)).toBeNull();
  });
  it("rejects expired grants and sessions", async () => {
    const { user, tokens } = await setup(),
      verifier = randomBytes(32).toString("base64url");
    const code = await tokens.createGrant("mobile", user.id, pkceChallenge(verifier));
    const later = new AuthTokens(db!, () => new Date(now.valueOf() + 61000));
    expect(await later.exchangeMobile(code, verifier)).toBeNull();
    const token = await tokens.issueSession(user.id, 10);
    expect(await later.verify(token, 86400)).toBeNull();
  });
  it("claims an email link once and keeps its purpose separate from mobile exchange", async () => {
    const { tokens } = await setup(),
      email = `${randomUUID()}@test.invalid`;
    subjects.push(email);
    const code = await tokens.createGrant("email", email);
    expect(await tokens.exchangeMobile(code, randomBytes(32).toString("base64url"))).toBeNull();
    const results = await Promise.all([tokens.consumeEmail(code), tokens.consumeEmail(code)]);
    expect(results.filter(Boolean)).toEqual([email]);
  });
});
afterAll(async () => {
  if (db) {
    await db.authGrant.deleteMany({ where: { subject: { in: subjects } } });
    await db.user.deleteMany({ where: { id: { in: owners } } });
    await db.$disconnect();
  }
});
