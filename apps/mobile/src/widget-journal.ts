import { NativeModules, Platform } from "react-native";
import type { EntryOperation } from "@ownday/core";
import type { LocalStore } from "./local-store";
import { journalWidgetSnapshot } from "./journal-widget-snapshot";
type Queued = { profileId: string; change: EntryOperation; createdAt: string };
const bridge = NativeModules.OwndayWidgetBridge as
  | undefined
  | {
      readPendingMutations(): Promise<string>;
      readLegacyMutations?(): Promise<string | null>;
      commitSnapshot(value: string, acknowledged: string): Promise<void>;
    };
let serial = Promise.resolve();
export async function captureLegacyWidget(store: LocalStore) {
  if (Platform.OS !== "web" && bridge?.readLegacyMutations)
    store.captureLegacy([["ownday.widget.pending.v1", await bridge.readLegacyMutations()]]);
}
export function updateJournalWidget(store: LocalStore) {
  const result = serial.then(async () => {
    if (Platform.OS === "web" || !bridge) return false;
    const pending = JSON.parse(await bridge.readPendingMutations()) as Queued[];
    if (!Array.isArray(pending)) throw new Error("INVALID_WIDGET_QUEUE");
    const remaining = [...pending].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const accepted: string[] = [];
    while (remaining.length) {
      const index = remaining.findIndex(
        (item) =>
          !remaining.some(
            (other) =>
              other.profileId === item.profileId &&
              other.change.operationId === item.change.dependsOn,
          ),
      );
      if (index < 0) break; // Retain malformed dependency cycles for recovery.
      const item = remaining.splice(index, 1)[0]!;
      try {
        if (store.importWidgetOperation(item.profileId, item.change))
          accepted.push(item.change.operationId);
      } catch {
        /* Keep unimportable native actions. */
      }
    }
    await bridge.commitSnapshot(
      JSON.stringify(journalWidgetSnapshot(store)),
      JSON.stringify(accepted),
    );
    return accepted.length > 0;
  });
  serial = result.then(
    () => {},
    () => {},
  );
  return result;
}
