import { randomUUID } from "node:crypto";
type Event = "sync.read" | "sync.write" | "auth.apple" | "auth.exchange";
/** Emit only operational metadata. Never record request bodies, URLs, identities or exception messages. */
export async function observeRequest(event: Event, run: () => Promise<Response>) {
  const requestId = randomUUID(),
    start = performance.now();
  let status = 500;
  try {
    const response = await run();
    status = response.status;
    response.headers.set("x-request-id", requestId);
    return response;
  } finally {
    console.info(
      JSON.stringify({
        event,
        requestId,
        status,
        durationMs: Math.round(performance.now() - start),
        at: new Date().toISOString(),
      }),
    );
  }
}
