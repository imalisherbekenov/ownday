import { NextResponse, type NextRequest } from "next/server";
import { refreshSessionCookie } from "@/lib/session";

/**
 * Slides the session forward on activity. This lives in middleware because
 * Server Components cannot set cookies — a platform limit, not a preference.
 * It only renews a session that already verifies; it never issues one.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  await refreshSessionCookie(request.cookies, response.cookies);
  return response;
}

// Next parses this object statically, so the pattern has to be a literal here —
// which is why the test reads it back off `config` instead of holding a copy.
// The file-extension branch is written `[.]`: inside a plain string `\.` is not an
// escape, and TypeScript would quietly hand the regex a bare dot.
export const config: { matcher: [string] } = {
  // API routes own their own cookie writes, and static assets carry no session.
  matcher: ["/((?!api/|api$|_next/static|_next/image|.*[.][^/]+$).*)"],
};

export const MIDDLEWARE_MATCHER = config.matcher[0];
