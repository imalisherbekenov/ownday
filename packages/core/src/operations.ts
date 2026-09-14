export type EntryAction =
  | { kind: "set"; status: "done" | "miss" | "skip"; value?: number }
  | { kind: "increment"; delta: number }
  | { kind: "skip" }
  | { kind: "unskip" }
  | { kind: "clear" };

export type EntryOperation = {
  operationId: string;
  habitId: string;
  localDate: string;
  baseRevision?: number;
  dependsOn?: string;
  action: EntryAction;
  /** Client's intended visible state, retained for conflict review; never used to apply the mutation. */
  clientIntent?: Pick<EntryValue, "status" | "value" | "deleted">;
};

export type EntryValue = {
  status: "done" | "skip" | "miss";
  value: number;
  revision: number;
  resetRevision: number;
  deleted: boolean;
};

/** Shared by SQLite and PostgreSQL; persistence and ownership stay with adapters. */
export function transitionEntry(
  current: EntryValue | null,
  operation: EntryOperation,
  habit: { type: "binary" | "counter" | "duration"; targetValue: number | null },
): EntryValue | null {
  assertEntryOperation(operation);
  const revision = current?.revision ?? 0;
  const commutative = operation.action.kind === "increment" && operation.action.delta > 0;
  if (
    operation.baseRevision !== undefined &&
    (operation.baseRevision > revision ||
      (commutative
        ? operation.baseRevision < (current?.resetRevision ?? 0)
        : operation.baseRevision !== revision))
  )
    return null;
  const visible = current?.deleted ? null : current;
  let value = visible?.value ?? 0,
    status = visible?.status ?? "miss",
    deleted = false;
  const target = habit.type === "binary" ? 1 : (habit.targetValue ?? 1);
  const numericStatus = () => (value >= target ? ("done" as const) : ("miss" as const));
  switch (operation.action.kind) {
    case "set":
      value = operation.action.value ?? (operation.action.status === "done" ? target : 0);
      status =
        habit.type === "binary" || operation.action.status === "skip"
          ? operation.action.status
          : numericStatus();
      break;
    case "increment":
      if (habit.type === "binary") throw new Error("HABIT_NOT_NUMERIC");
      value = Math.round(Math.max(0, value + operation.action.delta) * 1000) / 1000;
      if (value > 999999999.999) throw new Error("INVALID_VALUE");
      status = numericStatus();
      break;
    case "skip":
      status = "skip";
      break;
    case "unskip":
      status = numericStatus();
      break;
    case "clear":
      value = 0;
      status = "miss";
      deleted = true;
      break;
  }
  return {
    value,
    status,
    deleted,
    revision: revision + 1,
    resetRevision: commutative ? (current?.resetRevision ?? 0) : revision + 1,
  };
}

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function assertLocalDate(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("INVALID_LOCAL_DATE");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value)
    throw new Error("INVALID_LOCAL_DATE");
}

export function assertEntryOperation(value: EntryOperation): void {
  if (!value || typeof value !== "object") throw new Error("INVALID_OPERATION");
  if (!isUuid(value.operationId) || !isUuid(value.habitId)) throw new Error("INVALID_OPERATION_ID");
  if (
    value.dependsOn !== undefined &&
    (!isUuid(value.dependsOn) || value.dependsOn === value.operationId)
  )
    throw new Error("INVALID_DEPENDENCY");
  assertLocalDate(value.localDate);
  if (value.clientIntent !== undefined) {
    const intent = value.clientIntent;
    if (
      !intent ||
      !["done", "miss", "skip"].includes(intent.status) ||
      typeof intent.deleted !== "boolean" ||
      !Number.isFinite(intent.value) ||
      intent.value < 0 ||
      intent.value > 999999999.999 ||
      Math.abs(intent.value * 1000 - Math.round(intent.value * 1000)) > 0.0001
    )
      throw new Error("INVALID_CLIENT_INTENT");
  }
  if (
    value.baseRevision !== undefined &&
    (!Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0)
  )
    throw new Error("INVALID_REVISION");
  const action = value.action;
  if (!action || !["set", "increment", "skip", "unskip", "clear"].includes(action.kind))
    throw new Error("INVALID_ACTION");
  const numeric =
    action.kind === "increment" ? action.delta : action.kind === "set" ? action.value : undefined;
  if (
    numeric !== undefined &&
    (!Number.isFinite(numeric) ||
      Math.abs(numeric) > 999999999.999 ||
      Math.abs(numeric * 1000 - Math.round(numeric * 1000)) > 0.0001)
  )
    throw new Error("INVALID_VALUE");
  if (action.kind === "increment" && (numeric === undefined || numeric === 0))
    throw new Error("INVALID_VALUE");
  if (
    action.kind === "set" &&
    (!["done", "miss", "skip"].includes(action.status) ||
      (action.value !== undefined && action.value < 0))
  )
    throw new Error("INVALID_VALUE");
}
