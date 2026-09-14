import { describe, it, expect } from "vitest";
import { boundedJson } from "./bounded-json";
describe("bounded request body", () => {
  it("rejects a chunked oversized body without requiring Content-Length", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value":"'));
        controller.enqueue(new Uint8Array(32));
        controller.close();
      },
    });
    const request = new Request("https://example.test", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(boundedJson(request, 16)).rejects.toThrow("BODY_TOO_LARGE");
  });
  it("counts UTF-8 bytes and accepts a body within the limit", async () => {
    await expect(
      boundedJson(new Request("https://example.test", { method: "POST", body: '"Привет"' }), 8),
    ).rejects.toThrow("BODY_TOO_LARGE");
    expect(
      await boundedJson(
        new Request("https://example.test", { method: "POST", body: '{"ok":true}' }),
        32,
      ),
    ).toEqual({ ok: true });
  });
});
