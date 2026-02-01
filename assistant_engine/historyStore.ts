import type { LibraryType } from "./types";

type HistoryEntry = {
  recent: number[];
  updatedAt: number;
};

type HistoryState = Record<string, HistoryEntry>;

const HISTORY_KEY = "assistant_history_v1";
const MAX_RECENT = 5;

let storeCache: HistoryState | null = null;
let usingMemoryFallback = false;

async function getSecureStore() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require("expo-secure-store");
    return SecureStore;
  } catch (err) {
    usingMemoryFallback = true;
    console.warn("[assistant_engine] SecureStore unavailable; using in-memory history.");
    return null;
  }
}

async function loadStore(): Promise<HistoryState> {
  if (storeCache) return storeCache;
  if (usingMemoryFallback) {
    storeCache = {};
    return storeCache;
  }
  const SecureStore = await getSecureStore();
  if (!SecureStore) {
    storeCache = {};
    return storeCache;
  }
  try {
    const raw = await SecureStore.getItemAsync(HISTORY_KEY);
    storeCache = raw ? (JSON.parse(raw) as HistoryState) : {};
  } catch (error) {
    console.error("[assistant_engine] Failed to read history store:", error);
    storeCache = {};
  }
  return storeCache;
}

async function persistStore() {
  if (usingMemoryFallback || !storeCache) return;
  const SecureStore = await getSecureStore();
  if (!SecureStore) return;
  try {
    await SecureStore.setItemAsync(HISTORY_KEY, JSON.stringify(storeCache));
  } catch (error) {
    console.error("[assistant_engine] Failed to persist history store:", error);
  }
}

function keyFor(lib: LibraryType, intentId: string) {
  return `${lib}:${intentId}`;
}

export async function getRecentIndexes(lib: LibraryType, intentId: string): Promise<number[]> {
  const store = await loadStore();
  return store[keyFor(lib, intentId)]?.recent ?? [];
}

export async function rememberResponse(lib: LibraryType, intentId: string, index: number) {
  const store = await loadStore();
  const k = keyFor(lib, intentId);
  const entry = store[k] || { recent: [], updatedAt: 0 };
  entry.recent = [index, ...entry.recent.filter((i) => i !== index)].slice(0, MAX_RECENT);
  entry.updatedAt = Date.now();
  store[k] = entry;
  storeCache = store;
  await persistStore();
}

export function resetHistoryCache() {
  storeCache = null;
}

// Lightweight helper used only for tests to inject synthetic history.
export async function debugSetHistory(state: HistoryState) {
  storeCache = state;
  await persistStore();
}
