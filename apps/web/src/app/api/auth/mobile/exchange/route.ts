import { authTokens } from "@/lib/auth-tokens";
import { withinLimit } from "@/lib/rate-limit";
import { boundedJson } from "@/lib/bounded-json";
import { observeRequest } from "@/lib/observe-request";
export const runtime = "nodejs";
async function exchange(request: Request) {
  if (Number(request.headers.get("content-length")) > 2048)
    return new Response(null, { status: 413 });
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinLimit(`mobile-exchange:${address}`, 20, 60000)))
    return new Response(null, { status: 429 });
  try {
    const { code, verifier } = (await boundedJson(request, 2048)) as {
      code?: unknown;
      verifier?: unknown;
    };
    if (typeof code !== "string" || typeof verifier !== "string")
      return new Response(null, { status: 400 });
    const result = await authTokens().exchangeMobile(code, verifier);
    return Response.json(result ?? { error: "INVALID_GRANT" }, {
      status: result ? 200 : 401,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "EXCHANGE_FAILED" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export async function POST(request: Request) {
  return observeRequest("auth.exchange", () => exchange(request));
}
