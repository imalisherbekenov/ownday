// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./trpc";
const mocks = vi.hoisted(() => ({ change: vi.fn().mockResolvedValue({ outcome: "applied" }) }));
vi.mock("./services", () => ({ services: { applyEntryOperation: mocks.change } }));
const operation = {
  operationId: "6194befa-8a26-443a-9814-21c2cf505106",
  habitId: "79ea27df-0ecf-4f12-997e-e4d9a24cbff3",
  localDate: "2026-09-13",
  baseRevision: 0,
  action: { kind: "increment" as const, delta: 0.5 },
};
describe("entry API contract", () => {
  it("constructs a callable router and binds every change to the authenticated owner", async () => {
    await appRouter.createCaller({ userId: "owner" }).habits.changeEntry(operation);
    expect(mocks.change).toHaveBeenCalledWith({ ...operation, userId: "owner", source: "mobile" });
  });
  it("rejects missing authentication and an operation without its base revision", async () => {
    await expect(
      appRouter.createCaller({ userId: null }).habits.changeEntry(operation),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const { baseRevision, ...missing } = operation;
    await expect(
      appRouter.createCaller({ userId: "owner" }).habits.changeEntry(missing),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
