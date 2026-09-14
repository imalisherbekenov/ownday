import { assertLocalDate, validateSchedule, validateHabitFields } from "@ownday/core";
export { validateSchedule } from "@ownday/core";
import type { CreateHabitInput, UpdateHabitInput, User } from "./types.js";

export function validateHabit(input: UpdateHabitInput | CreateHabitInput) {
  validateHabitFields(input);
  if (input.schedule) validateSchedule(input.schedule);
  if (input.validFrom) assertLocalDate(input.validFrom);
}
export function validateUser(input: Partial<Pick<User, "timezone" | "dayStartHour" | "locale">>) {
  if (input.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format();
    } catch {
      throw new Error("INVALID_TIMEZONE");
    }
  }
  if (
    input.dayStartHour !== undefined &&
    (!Number.isInteger(input.dayStartHour) || input.dayStartHour < 0 || input.dayStartHour > 23)
  )
    throw new Error("INVALID_DAY_START");
  if (input.locale !== undefined && !["ru", "en"].includes(input.locale))
    throw new Error("INVALID_LOCALE");
}
