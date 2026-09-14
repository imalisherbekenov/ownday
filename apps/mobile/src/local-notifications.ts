import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { planNotifications } from "./notification-plan";
import type { LocalStore } from "./local-store";
const channel = "ownday-reminders";
let serial = Promise.resolve();
let currentStore: LocalStore | undefined;
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const visible =
      Boolean(currentStore) &&
      notification.request.content.data?.profileId === currentStore?.profileId;
    return {
      shouldShowBanner: visible,
      shouldShowList: visible,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});
export function watchReminderResponses(store: LocalStore, open: (habitId: string) => void) {
  currentStore = store;
  let active = true;
  const seen = new Set<string>();
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!active || !response) return;
    const request = response.notification.request,
      data = request.content.data ?? {};
    if (seen.has(request.identifier)) return;
    seen.add(request.identifier);
    if (
      data.profileId === store.profileId &&
      typeof data.habitId === "string" &&
      store.snapshot().habits.some((habit) => habit.id === data.habitId)
    )
      open(data.habitId);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };
  const listener = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync()
    .then(handle)
    .catch(() => {});
  return () => {
    active = false;
    listener.remove();
  };
}
export async function requestReminderPermission() {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync(channel, {
      name: "Ownday",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const permission = await Notifications.requestPermissionsAsync();
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}
export function reconcileNotifications(store: LocalStore) {
  currentStore = store;
  const result = serial.then(async () => {
    const snapshot = store.snapshot(),
      profile = snapshot.profileId;
    const permission = await Notifications.getPermissionsAsync();
    const planned =
      permission.granted ||
      permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
        ? planNotifications(snapshot, new Date())
        : [];
    const wanted = new Map(planned.map((item) => [item.id, item]));
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const shown of await Notifications.getPresentedNotificationsAsync()) {
      if (
        shown.request.identifier.startsWith("ownday:") &&
        shown.request.content.data?.profileId !== store.profileId
      )
        await Notifications.dismissNotificationAsync(shown.request.identifier);
    }
    for (const notification of existing) {
      if (!notification.identifier.startsWith("ownday:")) continue;
      const desired = wanted.get(notification.identifier);
      if (!desired || notification.content.body !== desired.body) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      } else wanted.delete(notification.identifier);
    }
    for (const item of wanted.values()) {
      if (store.profileId !== profile) break;
      await Notifications.scheduleNotificationAsync({
        identifier: item.id,
        content: {
          title: item.title,
          body: item.body,
          data: { profileId: profile, habitId: item.habitId, localDate: item.localDate },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.at,
          channelId: channel,
        },
      });
    }
    return planned.length;
  });
  serial = result.then(
    () => {},
    () => {},
  );
  return result;
}
