import "server-only";
import { cookies } from "next/headers";
import { validChallenge } from "@ownday/services";
import { sessionCookieOptions } from "./session";
export async function loginDestination() {
  const jar = await cookies(),
    pending = jar.get("ownday_mobile_login")?.value;
  if (!pending) return "/today";
  jar.set("ownday_mobile_login", "", { httpOnly: true, ...sessionCookieOptions(), maxAge: 0 });
  try {
    const { challenge, state } = JSON.parse(pending);
    if (validChallenge(challenge) && validChallenge(state))
      return `/api/auth/mobile/session?${new URLSearchParams({ challenge, state })}`;
  } catch {}
  return "/today";
}
