import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

type AppLockState = {
  enabled: boolean;
  pinHash?: string | null;
  salt?: string | null;
};

export type AppLockSecurityState = {
  attempts: number;
  maxAttempts: number;
  lockoutUntil: number | null;
  remainingMs: number;
  isLockedOut: boolean;
};

const ENABLED_KEY = "app_lock_enabled";
const PIN_HASH_KEY = "app_lock_pin_hash";
const SALT_KEY = "app_lock_salt";
const FAILED_ATTEMPTS_KEY = "app_lock_failed_attempts";
const LOCKED_UNTIL_KEY = "app_lock_locked_until";

export const APP_LOCK_MAX_ATTEMPTS = 5;
export const APP_LOCK_LOCKOUT_MS = 30_000;

async function getString(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn("SecureStore get failed", error);
    return null;
  }
}

async function setString(key: string, value: string | null) {
  try {
    if (value == null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.warn("SecureStore set failed", error);
  }
}

async function getNumber(key: string) {
  const raw = await getString(key);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

async function setNumber(key: string, value: number | null) {
  await setString(key, value == null ? null : String(value));
}

function toSecurityState(
  attempts: number,
  lockoutUntil: number | null,
  now = Date.now()
): AppLockSecurityState {
  const normalizedUntil = lockoutUntil && lockoutUntil > now ? lockoutUntil : null;
  const remainingMs = normalizedUntil ? Math.max(0, normalizedUntil - now) : 0;
  return {
    attempts,
    maxAttempts: APP_LOCK_MAX_ATTEMPTS,
    lockoutUntil: normalizedUntil,
    remainingMs,
    isLockedOut: remainingMs > 0,
  };
}

export async function getAppLockState(): Promise<AppLockState> {
  const enabledRaw = await getString(ENABLED_KEY);
  const enabled = enabledRaw === "true";
  const pinHash = await getString(PIN_HASH_KEY);
  const salt = await getString(SALT_KEY);
  return { enabled, pinHash, salt };
}

export async function setAppLockEnabled(enabled: boolean) {
  await setString(ENABLED_KEY, enabled ? "true" : "false");
  if (!enabled) {
    await clearFailedUnlockAttempts();
  }
}

export async function clearPin() {
  await setString(PIN_HASH_KEY, null);
  await setString(SALT_KEY, null);
  await clearFailedUnlockAttempts();
}

export async function setPinHash(pin: string) {
  const salt = Math.random().toString(36).slice(2, 10);
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + salt);
  await setString(PIN_HASH_KEY, digest);
  await setString(SALT_KEY, salt);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const { pinHash, salt } = await getAppLockState();
  if (!pinHash || !salt) return false;
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + salt);
  return digest === pinHash;
}

export async function clearFailedUnlockAttempts() {
  await setNumber(FAILED_ATTEMPTS_KEY, 0);
  await setNumber(LOCKED_UNTIL_KEY, null);
}

export async function getAppLockSecurityState(now = Date.now()): Promise<AppLockSecurityState> {
  const attempts = (await getNumber(FAILED_ATTEMPTS_KEY)) ?? 0;
  const lockoutUntil = await getNumber(LOCKED_UNTIL_KEY);
  const state = toSecurityState(attempts, lockoutUntil, now);
  if (lockoutUntil && !state.isLockedOut) {
    await setNumber(LOCKED_UNTIL_KEY, null);
  }
  return state;
}

export async function recordFailedUnlockAttempt(now = Date.now()): Promise<AppLockSecurityState> {
  const current = await getAppLockSecurityState(now);
  if (current.isLockedOut) return current;

  const nextAttempts = current.attempts + 1;
  if (nextAttempts >= APP_LOCK_MAX_ATTEMPTS) {
    const lockoutUntil = now + APP_LOCK_LOCKOUT_MS;
    await setNumber(FAILED_ATTEMPTS_KEY, 0);
    await setNumber(LOCKED_UNTIL_KEY, lockoutUntil);
    return toSecurityState(0, lockoutUntil, now);
  }

  await setNumber(FAILED_ATTEMPTS_KEY, nextAttempts);
  await setNumber(LOCKED_UNTIL_KEY, null);
  return toSecurityState(nextAttempts, null, now);
}
