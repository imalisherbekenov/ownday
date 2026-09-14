import { authTokens } from "@/lib/auth-tokens";
import { boundedJson } from "@/lib/bounded-json";
import { withinLimit } from "@/lib/rate-limit";
import { isUuid } from "@ownday/core";
export const runtime = "nodejs";
export async function DELETE(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!token.startsWith("od1_")) return new Response(null, { status: 401 });
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinLimit(`account-delete:${address}`, 10, 60000)))
    return new Response(null, { status: 429 });
  try {
    const body = (await boundedJson(request, 1024)) as { userId?: unknown; confirmation?: unknown };
    if (!isUuid(body.userId) || body.confirmation !== "DELETE")
      return new Response(null, { status: 400 });
    const deleted = await authTokens().deleteAccount(token, body.userId);
    return Response.json(
      { deleted },
      { status: deleted ? 200 : 401, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "DELETE_FAILED" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
