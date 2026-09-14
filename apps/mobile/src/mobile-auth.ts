import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Buffer } from "buffer";
import { isUuid } from "@ownday/core";
import { timedFetch } from "./timed-fetch";

const TRANSACTION = "ownday.auth.transaction.v2",
  CREDENTIALS = "ownday.auth.credentials.v2",
  REVOCATIONS = "ownday.auth.revocations.v2";
export const accountApiUrl = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://ownday.vercel.app"
).replace(/\/$/, "");
export type Credentials = { token: string; userId: string; expiresAt: string; appleUser?: string };
const valid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
const random = () => Buffer.from(Crypto.getRandomBytes(32)).toString("base64url");
let appleChecked: { token: string; at: number } | null = null;
export async function credentials(): Promise<Credentials | null> {
  if (Platform.OS === "web") return null;
  void flushRevocations().catch(() => {});
  const saved = await SecureStore.getItemAsync(CREDENTIALS);
  const current: Credentials | null = saved ? JSON.parse(saved) : null;
  if (
    current?.appleUser &&
    Platform.OS === "ios" &&
    (!appleChecked || appleChecked.token !== current.token || Date.now() - appleChecked.at > 60000)
  ) {
    const Apple = await import("expo-apple-authentication");
    const state = await Apple.getCredentialStateAsync(current.appleUser);
    if ((await SecureStore.getItemAsync(CREDENTIALS)) !== saved) return credentials();
    if (state !== Apple.AppleAuthenticationCredentialState.AUTHORIZED) {
      await editRevocations((pending) =>
        pending.includes(current.token) ? pending : [...pending, current.token],
      );
      if ((await SecureStore.getItemAsync(CREDENTIALS)) === saved)
        await SecureStore.deleteItemAsync(CREDENTIALS);
      void flushRevocations().catch(() => {});
      return null;
    }
    appleChecked = { token: current.token, at: Date.now() };
  }
  return current;
}
let completing: Promise<Credentials> | null = null;
export function completeMobileLogin(url: string) {
  if (completing) return completing;
  completing = exchange(url).finally(() => {
    completing = null;
  });
  return completing;
}
async function exchange(url: string): Promise<Credentials> {
  const callback = new URL(url),
    code = callback.searchParams.get("code"),
    state = callback.searchParams.get("state");
  if (
    callback.protocol !== "ownday:" ||
    callback.hostname !== "auth" ||
    callback.pathname !== "/callback" ||
    !valid(code) ||
    !valid(state)
  )
    throw new Error("INVALID_CALLBACK");
  const saved = await SecureStore.getItemAsync(TRANSACTION);
  if (!saved) throw new Error("LOGIN_EXPIRED");
  const transaction = JSON.parse(saved) as { state: string; verifier: string; createdAt: number };
  if (transaction.state !== state || Date.now() - transaction.createdAt > 600000)
    throw new Error("LOGIN_EXPIRED");
  const response = await timedFetch(`${accountApiUrl}/api/auth/mobile/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, verifier: transaction.verifier }),
  });
  if (!response.ok) throw new Error("LOGIN_FAILED");
  const result = (await response.json()) as Credentials;
  if (
    !/^od1_[A-Za-z0-9_-]{43}$/.test(result.token) ||
    !isUuid(result.userId) ||
    !Number.isFinite(Date.parse(result.expiresAt))
  )
    throw new Error("INVALID_SESSION");
  await SecureStore.setItemAsync(CREDENTIALS, JSON.stringify(result));
  await SecureStore.deleteItemAsync(TRANSACTION);
  return result;
}
export async function beginMobileLogin() {
  if (Platform.OS === "web") throw new Error("NATIVE_LOGIN_REQUIRED");
  const verifier = random(),
    state = random();
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await SecureStore.setItemAsync(
    TRANSACTION,
    JSON.stringify({ verifier, state, createdAt: Date.now() }),
  );
  const result = await WebBrowser.openAuthSessionAsync(
    `${accountApiUrl}/api/auth/mobile/session?${new URLSearchParams({ challenge, state })}`,
    "ownday://auth/callback",
  );
  return result.type === "success" ? completeMobileLogin(result.url) : null;
}
export async function beginAppleLogin(): Promise<Credentials | null> {
  if (Platform.OS !== "ios") throw new Error("IOS_REQUIRED");
  const Apple = await import("expo-apple-authentication");
  const challenge = await timedFetch(`${accountApiUrl}/api/auth/apple/challenge`, {
    method: "POST",
  });
  if (!challenge.ok) throw new Error("APPLE_NOT_AVAILABLE");
  const { nonce } = (await challenge.json()) as { nonce: string };
  if (!valid(nonce)) throw new Error("INVALID_NONCE");
  let result;
  try {
    result = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.EMAIL],
      nonce,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw error;
  }
  if (!result.identityToken) throw new Error("IDENTITY_MISSING");
  const response = await timedFetch(`${accountApiUrl}/api/auth/apple/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identityToken: result.identityToken,
      nonce,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: Intl.DateTimeFormat().resolvedOptions().locale.startsWith("ru") ? "ru" : "en",
    }),
  });
  if (!response.ok) throw new Error("APPLE_SIGN_IN_FAILED");
  const current = (await response.json()) as Credentials;
  if (
    !/^od1_[A-Za-z0-9_-]{43}$/.test(current.token) ||
    !isUuid(current.userId) ||
    !Number.isFinite(Date.parse(current.expiresAt))
  )
    throw new Error("INVALID_SESSION");
  current.appleUser = result.user;
  await SecureStore.setItemAsync(CREDENTIALS, JSON.stringify(current));
  return current;
}
export async function signOut() {
  const current = await credentials();
  if (current) {
    // Save revocation intent before removing the credential; offline logout still isolates profiles.
    await editRevocations((pending) =>
      pending.includes(current.token) ? pending : [...pending, current.token],
    );
  }
  await SecureStore.deleteItemAsync(CREDENTIALS);
  await SecureStore.deleteItemAsync("ownday.session");
  void flushRevocations().catch(() => {});
}
export async function deleteMobileAccount(expectedUserId: string) {
  const saved = await SecureStore.getItemAsync(CREDENTIALS);
  const current: Credentials | null = saved ? JSON.parse(saved) : null;
  if (!current || current.userId !== expectedUserId) throw new Error("SESSION_CHANGED");
  const response = await timedFetch(`${accountApiUrl}/api/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", authorization: `Bearer ${current.token}` },
    body: JSON.stringify({ userId: expectedUserId, confirmation: "DELETE" }),
  });
  if (!response.ok || ((await response.json()) as { deleted?: boolean }).deleted !== true)
    throw new Error("DELETE_NOT_CONFIRMED");
  // A lost response can be retried with this credential for seven days, even after server deletion.
  return async () => {
    if ((await SecureStore.getItemAsync(CREDENTIALS)) === saved)
      await SecureStore.deleteItemAsync(CREDENTIALS);
  };
}
let revoking: Promise<void> | null = null;
let revocationEdits = Promise.resolve();
function editRevocations(edit: (tokens: string[]) => string[]) {
  const result = revocationEdits.then(async () => {
    const pending = JSON.parse((await SecureStore.getItemAsync(REVOCATIONS)) ?? "[]") as string[];
    await SecureStore.setItemAsync(REVOCATIONS, JSON.stringify(edit(pending)));
  });
  revocationEdits = result.catch(() => {});
  return result;
}
function flushRevocations(): Promise<void> {
  if (revoking) return revoking;
  revoking = (async () => {
    const pending = JSON.parse((await SecureStore.getItemAsync(REVOCATIONS)) ?? "[]") as string[];
    for (const token of pending) {
      const response = await timedFetch(`${accountApiUrl}/api/auth/mobile/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok && response.status !== 401) throw new Error("LOGOUT_FAILED");
      await editRevocations((latest) => latest.filter((value) => value !== token));
    }
  })().finally(() => {
    revoking = null;
  });
  return revoking;
}
