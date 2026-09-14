import { cookies } from "next/headers";
export async function interfaceLocale() {
  return (await cookies()).get("ownday_locale")?.value === "en" ? ("en" as const) : ("ru" as const);
}
