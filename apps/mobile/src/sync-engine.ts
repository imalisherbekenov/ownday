import { syncEntity } from "@ownday/core";
import type { SyncOperation, SyncResult, SyncSnapshot } from "@ownday/core";
import type { LocalStore } from "./local-store";
export interface SyncTransport {
  snapshot(): Promise<SyncSnapshot>;
  change(operation: SyncOperation): Promise<SyncResult>;
}
const engines = new WeakMap<LocalStore, SyncEngine>();
export function syncForStore(store: LocalStore) {
  let engine = engines.get(store);
  if (!engine) {
    engine = new SyncEngine(store);
    engines.set(store, engine);
  }
  return engine;
}
/** A single runner per store, with profile checks after every asynchronous boundary. */
export class SyncEngine {
  private running: Promise<void> | null = null;
  constructor(private store: LocalStore) {}
  run(userId: string, transport: SyncTransport): Promise<void> {
    if (this.running) return this.running;
    this.running = this.synchronize(`account:${userId}`, transport).finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async synchronize(profile: string, transport: SyncTransport) {
    const assertProfile = () => {
      if (this.store.profileId !== profile) throw new Error("PROFILE_CHANGED");
    };
    assertProfile();
    // Capture a finite batch: continuous tapping must not prevent the final pull.
    const batch = this.store.outbox();
    const blocked = new Set(
      batch
        .filter((item) => item.status === "conflict")
        .map((item) => syncEntity(this.store.operation(item))),
    );
    for (const item of batch) {
      assertProfile();
      const operation = this.store.operation(item),
        entity = syncEntity(operation);
      if (blocked.has(entity)) continue;
      if (operation.kind === "entry" && blocked.has(`habit:${operation.change.habitId}`)) continue;
      const result = await transport.change(operation);
      assertProfile();
      this.store.acknowledge(profile, result);
      if (result.outcome === "conflict") blocked.add(entity);
    }
    const snapshot = await transport.snapshot();
    assertProfile();
    this.store.acceptSnapshot(profile, snapshot);
    this.store.importLegacyReviews(snapshot);
  }
}
