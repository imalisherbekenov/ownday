// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSession,
  issueSession,
  readSession,
  refreshSessionCookie,
  sessionCookieOptions,
} from "./session";

afterEach(() => vi.unstubAllEnvs());

describe("sessionCookieOptions", () => {
  it("goes cross-site when CROSS_SITE_COOKIES is on", () => {
    vi.stubEnv("CROSS_SITE_COOKIES", "1");
    expect(sessionCookieOptions()).toMatchObject({ sameSite: "none", secure: true });
  });

  it("stays lax and insecure outside production when the switch is off", () => {
    vi.stubEnv("CROSS_SITE_COOKIES", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions()).toMatchObject({ sameSite: "lax", secure: false });
  });

  it("stays lax but secure in production when the switch is off", () => {
    vi.stubEnv("CROSS_SITE_COOKIES", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions()).toMatchObject({ sameSite: "lax", secure: true });
  });

  it("ignores NODE_ENV when the switch is on", () => {
    vi.stubEnv("CROSS_SITE_COOKIES", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions()).toMatchObject({ sameSite: "none", secure: true });
  });
});

type CookieWrite = { name: string; value: string; options: Record<string, unknown> };
const { jar, writes } = vi.hoisted(() => ({
  jar: new Map<string, { value: string; maxAge: number | undefined }>(),
  writes: [] as { name: string; value: string; options: Record<string, unknown> }[],
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = jar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, options: Record<string, unknown>) => {
      writes.push({ name, value, options });
      // A browser drops a cookie written with a non-positive max-age. Deleting one
      // is just such a write, so the jar has to behave the same way — otherwise the
      // attributes that decide whether the deletion arrives go unobserved.
      if (typeof options.maxAge === "number" && options.maxAge <= 0) jar.delete(name);
      else jar.set(name, { value, maxAge: options.maxAge as number | undefined });
    },
    delete: (name: string) => jar.delete(name),
  }),
}));
const reset = () => {
  jar.clear();
  writes.length = 0;
};

describe("issueSession / clearSession", () => {
  afterEach(reset);

  it("reads back the user it signed in", async () => {
    await issueSession("user-1");
    expect(await readSession()).toBe("user-1");
  });

  it("clears the very cookie it issued", async () => {
    await issueSession("user-1");
    expect(jar.size).toBe(1);
    await clearSession();
    expect(jar.size).toBe(0);
    expect(await readSession()).toBeNull();
  });

  it("keeps the session for seven days", async () => {
    await issueSession("user-1");
    expect([...jar.values()][0]?.maxAge).toBe(7 * 24 * 60 * 60);
  });
});

describe("refreshSessionCookie", () => {
  afterEach(reset);

  const readerOf = (name: string, value: string) => ({
    get: (asked: string) => (asked === name ? { value } : undefined),
  });

  it("slides a live session forward under the same name", async () => {
    await issueSession("user-1");
    const [name, entry] = [...jar.entries()][0]!;
    const written: { name: string; value: string; maxAge: number | undefined }[] = [];
    const renewed = await refreshSessionCookie(readerOf(name, entry.value), {
      set: (cookieName, value, options) =>
        written.push({ name: cookieName, value, maxAge: options.maxAge as number | undefined }),
    });
    expect(renewed).toBe(true);
    expect(written).toHaveLength(1);
    expect(written[0]?.name).toBe(name);
    expect(written[0]?.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it("writes nothing when there is no session to renew", async () => {
    const written: string[] = [];
    const renewed = await refreshSessionCookie(
      { get: () => undefined },
      { set: (cookieName) => written.push(cookieName) },
    );
    expect(renewed).toBe(false);
    expect(written).toEqual([]);
  });

  it("writes nothing when the cookie carries a forged token", async () => {
    await issueSession("user-1");
    const name = [...jar.keys()][0]!;
    const written: string[] = [];
    const renewed = await refreshSessionCookie(readerOf(name, "not.a.jwt"), {
      set: (cookieName) => written.push(cookieName),
    });
    expect(renewed).toBe(false);
    expect(written).toEqual([]);
  });
});

describe("cookie attributes on the wire", () => {
  afterEach(reset);

  const switchPositions = [
    ["1", { sameSite: "none", secure: true, path: "/" }],
    ["", { sameSite: "lax", secure: false, path: "/" }],
  ] as const;

  it.each(switchPositions)(
    "issues the session with the attributes of CROSS_SITE_COOKIES=%s",
    async (position, expected) => {
      vi.stubEnv("CROSS_SITE_COOKIES", position);
      vi.stubEnv("NODE_ENV", "development");
      await issueSession("user-1");
      expect(writes.at(-1)?.options).toMatchObject({ ...expected, httpOnly: true });
    },
  );

  it.each(switchPositions)(
    "clears the session with those same attributes at CROSS_SITE_COOKIES=%s",
    async (position, expected) => {
      vi.stubEnv("CROSS_SITE_COOKIES", position);
      vi.stubEnv("NODE_ENV", "development");
      await issueSession("user-1");
      await clearSession();
      const clearing = writes.at(-1) as CookieWrite;
      expect(clearing.name).toBe(writes[0]?.name);
      expect(clearing.options).toMatchObject(expected);
      expect(clearing.options.maxAge).toBe(0);
      expect(jar.size).toBe(0);
    },
  );

  it("renews the session with the attributes of the current switch position", async () => {
    vi.stubEnv("CROSS_SITE_COOKIES", "1");
    await issueSession("user-1");
    const [name, entry] = [...jar.entries()][0]!;
    const renewals: CookieWrite[] = [];
    await refreshSessionCookie(
      { get: (asked: string) => (asked === name ? { value: entry.value } : undefined) },
      {
        set: (cookieName, value, options) =>
          renewals.push({ name: cookieName, value, options: options as Record<string, unknown> }),
      },
    );
    expect(renewals.at(-1)?.options).toMatchObject({
      sameSite: "none",
      secure: true,
      path: "/",
      httpOnly: true,
    });
  });
});
