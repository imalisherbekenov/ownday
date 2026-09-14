import { authTokens } from "@/lib/auth-tokens";
import { withinLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.APPLE_NATIVE_CLIENT_ID)
    return Response.json({ error: "APPLE_NOT_CONFIGURED" }, { status: 503 });
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await withinLimit(`apple-challenge:${address}`, 10, 60000)))
    return new Response(null, { status: 429 });
  return Response.json(
    { nonce: await authTokens().createAppleChallenge() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
