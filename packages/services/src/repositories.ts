import type { EntryStatus, LocalDate, EntryOperation } from "@ownday/core";
import type {
  CreateHabitInput,
  EntrySource,
  Habit,
  HabitEntry,
  HabitReminder,
  HabitStats,
  HabitTemplate,
  Identity,
  UpdateHabitInput,
  User,
} from "./types.js";

export type MarkEntryInput = {
  userId: string;
  habitId: string;
  localDate: LocalDate;
  value?: number;
  status: EntryStatus;
  source: EntrySource;
  clientId: string;
};

export interface HabitRepository {
  create(input: CreateHabitInput): Promise<Habit>;
  update(id: string, userId: string, input: UpdateHabitInput): Promise<Habit | null>;
  findById(id: string): Promise<Habit | null>;
  listByUser(userId: string, includeArchived?: boolean): Promise<Habit[]>;
  archive(id: string, userId: string, at: Date, localDate?: string): Promise<boolean>;
  restore(id: string, userId: string, at?: Date, localDate?: string): Promise<boolean>;
  /**
   * Стирает привычку насовсем вместе с её статистикой. Отметки и напоминания
   * снимает вызывающий: в базе за них отвечает каскад, в памяти — никто, и
   * договориться об этом надо в одном месте, а не в двух реализациях.
   */
  delete(id: string, userId: string, requireArchived?: boolean): Promise<boolean>;
  reorder(userId: string, ids: string[]): Promise<void>;
  writeStats(stats: HabitStats): Promise<void>;
}
export interface TemplateRepository {
  list(locale: "ru" | "en"): Promise<HabitTemplate[]>;
}

export interface EntryRepository {
  applyOperation(
    input: EntryOperationInput,
    context: { habit: Habit; user: User },
  ): Promise<EntryOperationResult>;
  deleteByHabit(habitId: string): Promise<void>;
  listForHabit(habitId: string, through?: LocalDate): Promise<HabitEntry[]>;
  listForUser(userId: string, from: LocalDate, through: LocalDate): Promise<HabitEntry[]>;
}

export type EntryOperationInput = EntryOperation & {
  userId: string;
  source: EntrySource;
  now: Date;
  conflictOnIneligible?: boolean;
};
export type EntryOperationResult = {
  operationId: string;
  outcome: "applied" | "conflict";
  revision: number;
  entry: HabitEntry | null;
  /** Includes a tombstone for synchronization; entry remains the legacy visible value. */
  state?: HabitEntry | null;
  reason?: string;
};

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findIdentity(
    provider: Identity["provider"],
    externalId: string,
  ): Promise<{ user: User; identity: Identity } | null>;
  findIdentityForUser(userId: string, provider: Identity["provider"]): Promise<Identity | null>;
  /**
   * Идемпотентно: если пара (provider, externalId) уже занята, возвращается
   * существующая запись — та, что есть, а не та, что просили. Владельца она не
   * меняет, поэтому вызывающий обязан сам убедиться, что пара свободна.
   */
  addIdentity(
    userId: string,
    provider: Identity["provider"],
    externalId: string,
  ): Promise<Identity>;
  createWithIdentity(input: {
    provider: Identity["provider"];
    externalId: string;
    timezone: string;
    dayStartHour: number;
    locale: User["locale"];
  }): Promise<User>;
  update(
    id: string,
    input: Partial<Pick<User, "timezone" | "dayStartHour" | "locale">>,
  ): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}

export interface ReminderRepository {
  findById(id: string): Promise<HabitReminder | null>;
  due(now: Date, limit: number): Promise<HabitReminder[]>;
  updateNextFireAt(id: string, at: Date): Promise<HabitReminder | null>;
  create(input: Omit<HabitReminder, "id">): Promise<HabitReminder>;
  listByUser(userId: string): Promise<HabitReminder[]>;
  deleteByHabit(habitId: string): Promise<void>;
}
