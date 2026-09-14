import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { services } from "./services";
import { assertEntryOperation, type EntryOperation } from "@ownday/core";
const t = initTRPC.context<{ userId: string | null }>().create();
const authed = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { userId: ctx.userId } });
});
export const appRouter = t.router({
  mobile: t.router({
    bootstrap: authed.query(async ({ ctx }) => ({
      user: await services.getUser(ctx.userId),
      today: await services.listHabitsForToday(ctx.userId, new Date()),
    })),
  }),
  habits: t.router({
    changeEntry: authed
      .input((value: unknown) => {
        if (!value || typeof value !== "object") throw new TRPCError({ code: "BAD_REQUEST" });
        const operation = value as EntryOperation;
        assertEntryOperation(operation);
        if (operation.baseRevision === undefined)
          throw new TRPCError({ code: "BAD_REQUEST", message: "BASE_REVISION_REQUIRED" });
        return operation;
      })
      .mutation(({ ctx, input }) =>
        services.applyEntryOperation({ ...input, userId: ctx.userId, source: "mobile" }),
      ),
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
