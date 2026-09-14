import type { SyncOperation, SyncResult, SyncSnapshot } from "@ownday/core";
import type { SyncTransport } from "./sync-engine";
import { accountApiUrl } from "./mobile-auth";
import type { Credentials } from "./mobile-auth";
export function accountTransport(session: Credentials): SyncTransport {
  async function request<T>(operation?: SyncOperation): Promise<T> {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${accountApiUrl}/api/sync`, {
        method: operation ? "POST" : "GET",
        signal: controller.signal,
        headers: { authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        ...(operation ? { body: JSON.stringify(operation) } : {}),
      });
      if (response.status === 401) throw new Error("SESSION_EXPIRED");
      if (!response.ok)
        throw new Error(response.status === 429 ? "RATE_LIMITED" : "SYNC_UNAVAILABLE");
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    snapshot: () => request<SyncSnapshot>(),
    change: (operation) => request<SyncResult>(operation),
  };
}
