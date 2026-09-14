import "server-only";
import { PrismaClient } from "@ownday/db";
import { SyncService } from "@ownday/services";
const scope = globalThis as typeof globalThis & { __owndaySyncDb?: PrismaClient };
export const journalService = () => new SyncService((scope.__owndaySyncDb ??= new PrismaClient()));
