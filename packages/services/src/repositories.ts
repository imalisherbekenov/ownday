import type { EntryStatus, LocalDate } from "@ownday/core";
import type {
  CreateHabitInput,
  EntrySource,
  Habit,
  HabitEntry,
  HabitReminder,
  HabitStats,
  Identity,
  UpdateHabitInput,
  User,
} from "./types.js";

export type SetEntryValueInput = {
  userId: string;
  habitId: string;
  localDate: LocalDate;
  value: number;
  status: EntryStatus;
  source: EntrySource;
};

export interface HabitRepository {
  create(input: CreateHabitInput): Promise<Habit>;
  update(id: string, userId: string, input: UpdateHabitInput): Promise<Habit | null>;
  findById(id: string): Promise<Habit | null>;
  listByUser(userId: string, includeArchived?: boolean): Promise<Habit[]>;
  archive(id: string, userId: string, at: Date): Promise<boolean>;
  reorder(userId: string, ids: string[]): Promise<void>;
  writeStats(stats: HabitStats): Promise<void>;
}

export interface EntryRepository {
  findByClientId(clientId: string): Promise<HabitEntry | null>;
  upsert(input: {
    userId: string;
    habitId: string;
    localDate: LocalDate;
    status: EntryStatus;
    value?: number;
    source: EntrySource;
    clientId: string;
  }): Promise<HabitEntry>;
  setValue(input: SetEntryValueInput): Promise<HabitEntry>;
  delete(habitId: string, localDate: LocalDate, userId: string): Promise<boolean>;
  listForHabit(habitId: string, through?: LocalDate): Promise<HabitEntry[]>;
  listForUser(userId: string, from: LocalDate, through: LocalDate): Promise<HabitEntry[]>;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findIdentity(
    provider: Identity["provider"],
    externalId: string,
  ): Promise<{ user: User; identity: Identity } | null>;
  findIdentityForUser(userId: string, provider: Identity["provider"]): Promise<Identity | null>;
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
}

export interface ReminderRepository {
  findById(id: string): Promise<HabitReminder | null>;
  due(now: Date, limit: number): Promise<HabitReminder[]>;
  updateNextFireAt(id: string, at: Date): Promise<HabitReminder | null>;
  create(input: Omit<HabitReminder, "id">): Promise<HabitReminder>;
  listByUser(userId: string): Promise<HabitReminder[]>;
}
