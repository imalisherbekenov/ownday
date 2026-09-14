import type { LocalStore } from "./local-store";
export function watchReminderResponses(_store: LocalStore, _open: (habitId: string) => void) {
  return () => {};
}
export async function requestReminderPermission() {
  return false;
}
export async function reconcileNotifications(_store: LocalStore) {
  return 0;
}
