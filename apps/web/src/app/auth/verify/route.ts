import { completeMagicLink } from "../actions";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 400 });
  await completeMagicLink(token);
  return new Response(null, { status: 302, headers: { Location: "/" } });
}
