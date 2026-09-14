import { authTokens } from "@/lib/auth-tokens";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer od1_")) return new Response(null, { status: 401 });
  await authTokens().revoke(authorization.slice(7));
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
