import { openDatabaseAsync } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { LocalStore } from "./local-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateJournalWidget, captureLegacyWidget } from "./widget-journal";
let store: Promise<LocalStore> | undefined;
export const getLocalStore = () =>
  (store ??= openDatabaseAsync("ownday.db")
    .then(async (database) => {
      const local = new LocalStore(database, randomUUID);
      const sources = await AsyncStorage.multiGet([
        "ownday.query-cache.v1",
        "ownday.mutation-queue.v1",
      ]);
      local.captureLegacy(sources);
      await captureLegacyWidget(local).catch(() => {});
      await updateJournalWidget(local).catch(() => {});
      return local;
    })
    .catch((error) => {
      store = undefined;
      throw error;
    }));
