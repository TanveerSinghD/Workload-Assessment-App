import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

type AppLockState = {
  enabled: boolean;
  pinHash?: string | null;
  salt?: string | null;
};

const ENABLED_KEY = "app_lock_enabled";
const PIN_HASH_KEY = "app_lock_pin_hash";
const SALT_KEY = "app_lock_salt";

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

export async function getAppLockState(): Promise<AppLockState> {
  const enabledRaw = await getString(ENABLED_KEY);
  const enabled = enabledRaw === "true";
  const pinHash = await getString(PIN_HASH_KEY);
  const salt = await getString(SALT_KEY);
  return { enabled, pinHash, salt };
}

export async function setAppLockEnabled(enabled: boolean) {
  await setString(ENABLED_KEY, enabled ? "true" : "false");
}

export async function clearPin() {
  await setString(PIN_HASH_KEY, null);
  await setString(SALT_KEY, null);
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
