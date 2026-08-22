import { issueMobileSession, readSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await readSession();
  const requestUrl = new URL(request.url);
  const returnUrl = requestUrl.searchParams.get("returnUrl");
  if (!returnUrl?.startsWith("ownday://auth/callback"))
    return new Response("Invalid return URL", { status: 400 });
  if (!userId) {
    const signIn = new URL("/", requestUrl);
    signIn.searchParams.set("mobileReturnUrl", requestUrl.toString());
    return Response.redirect(signIn);
  }
  const callback = new URL(returnUrl);
  callback.searchParams.set("token", await issueMobileSession(userId));
  return Response.redirect(callback);
}
