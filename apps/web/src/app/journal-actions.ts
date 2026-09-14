"use server";
import { assertSyncOperation } from "@ownday/core";
import type { SyncOperation } from "@ownday/core";
import { getCurrentUserId } from "@/lib/services";
import { journalService } from "@/lib/journal-service";
import { withinLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
export async function applyJournalOperation(expectedUserId: string, operation: SyncOperation) {
  const owner = await getCurrentUserId();
  if (owner !== expectedUserId) throw new Error("SESSION_CHANGED");
  assertSyncOperation(operation);
  if (!(await withinLimit(`journal:write:${owner}`, 600, 60000))) throw new Error("RATE_LIMITED");
  const result = await journalService().change(owner, operation, "web");
  revalidatePath("/stats");
  revalidatePath("/habits");
  revalidatePath(`/habit/${operation.kind === "entry" ? operation.change.habitId : operation.change.habit.id}`);
  return result;
}
