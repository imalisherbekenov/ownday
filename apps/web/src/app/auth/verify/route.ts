import { redirect } from "next/navigation";
import { completeMagicLink } from "../actions";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) redirect("/auth/login?error=link");
  // Обе ветки completeMagicLink заканчиваются redirect(): либо на сегодня, либо
  // обратно на вход с причиной. Возвращать отсюда нечего.
  await completeMagicLink(token);
}
