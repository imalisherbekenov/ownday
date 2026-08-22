import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";
import * as SecureStore from "expo-secure-store";
import { MutationQueue } from "./mutation-queue";
import type { QueuedMutation, QueueStorage } from "./mutation-queue";
import { queryClient } from "./query";
import { takeWidgetMutations, writeWidgetSnapshot } from "./widget-snapshot";
import type { Bootstrap } from "./types";

const SESSION_KEY = "ownday.session";
const QUEUE_KEY = "ownday.mutation-queue.v1";
export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://10.0.2.2:3000";

export const session = {
  get: () => SecureStore.getItemAsync(SESSION_KEY),
  set: (token: string) => SecureStore.setItemAsync(SESSION_KEY, token),
  clear: () => SecureStore.deleteItemAsync(SESSION_KEY),
};

export const trpc = createTRPCUntypedClient({
  links: [
    httpBatchLink({
      url: `${apiUrl}/api/trpc`,
      async headers() {
        const token = await session.get();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

const queueStorage: QueueStorage = {
  async load() {
    const value = await AsyncStorage.getItem(QUEUE_KEY);
    return value ? (JSON.parse(value) as QueuedMutation[]) : [];
  },
  save: (items) => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items)),
};

const refreshSnapshot = async () => {
  const data = queryClient.getQueryData<Bootstrap>(["mobile.bootstrap"]);
  if (data) await writeWidgetSnapshot(data);
};

export const mutationQueue = new MutationQueue(
  queueStorage,
  async (mutation) => {
    await trpc.mutation("habits.mark", mutation);
  },
  refreshSnapshot,
);

export async function importWidgetMutations() {
  for (const mutation of await takeWidgetMutations()) await mutationQueue.enqueue(mutation);
}

export function watchNetwork(onPendingChange: () => void) {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) void mutationQueue.flush().then(onPendingChange);
  });
}
