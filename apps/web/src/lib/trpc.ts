import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { services } from "./services";
const t = initTRPC.context<{ userId: string | null }>().create();
const authed = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { userId: ctx.userId } });
});
export const appRouter = t.router({
  habits: t.router({
    list: authed.query(({ ctx }) => services.listHabits(ctx.userId)),
    today: authed.query(({ ctx }) => services.listHabitsForToday(ctx.userId, new Date())),
    mark: authed
      .input(
        z.object({
          habitId: z.string(),
          localDate: z.string(),
          status: z.enum(["done", "skip", "miss"]),
          clientId: z.string(),
        }),
      )
      .mutation(({ ctx, input }) =>
        services.markEntry({ ...input, userId: ctx.userId, source: "mobile" }),
      ),
  }),
  summary: authed
    .input(z.object({ days: z.number().int().positive().max(366) }))
    .query(({ ctx, input }) => services.getUserSummary(ctx.userId, { days: input.days })),
});
export type AppRouter = typeof appRouter;
