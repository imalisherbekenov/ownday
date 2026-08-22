import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/lib/trpc";
import { readSessionFromRequest } from "@/lib/session";
export const runtime = "nodejs";
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => ({ userId: await readSessionFromRequest(req) }),
  });
export { handler as GET, handler as POST };
