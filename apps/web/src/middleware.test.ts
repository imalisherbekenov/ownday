// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MIDDLEWARE_MATCHER } from "./middleware";

// Next anchors the matcher over the whole pathname before running middleware.
const matches = (pathname: string) => new RegExp(`^${MIDDLEWARE_MATCHER}$`).test(pathname);

describe("middleware matcher", () => {
  it.each([
    "/",
    "/habits",
    "/habits/new",
    "/habits/abc123/edit",
    "/habit/abc123",
    "/templates",
    "/settings",
    "/stats",
  ])("renews the session on %s", (pathname) => {
    expect(matches(pathname)).toBe(true);
  });

  it.each([
    "/api",
    "/api/auth/telegram",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/icon.png",
    "/manifest.webmanifest",
  ])("stays out of %s", (pathname) => {
    expect(matches(pathname)).toBe(false);
  });
});
