import { LibraryType } from "./types";

type TaskMemoryEntry = {
  lastMessage: string;
  updatedAt: number;
};

type TaskMemoryState = Record<string, TaskMemoryEntry>;

const KEY = "assistant_task_memory_v1";

let cache: TaskMemoryState | null = null;
let memFallback = false;

async function getSecureStore() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require("expo-secure-store");
    return SecureStore;
  } catch (error) {
    memFallback = true;
    console.warn("[assistant_engine] SecureStore unavailable; task memory will be volatile.");
    return null;
  }
}

async function load(): Promise<TaskMemoryState> {
  if (cache) return cache;
  if (memFallback) {
    cache = {};
    return cache;
  }
  const store = await getSecureStore();
  if (!store) {
    cache = {};
    return cache;
  }
  try {
    const raw = await store.getItemAsync(KEY);
    cache = raw ? (JSON.parse(raw) as TaskMemoryState) : {};
  } catch (error) {
    console.error("[assistant_engine] Failed to load task memory:", error);
    cache = {};
  }
  return cache;
}

async function persist() {
  if (memFallback || !cache) return;
  const store = await getSecureStore();
  if (!store) return;
  try {
    await store.setItemAsync(KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("[assistant_engine] Failed to persist task memory:", error);
  }
}

function makeKey(taskId: number, lib: LibraryType) {
  return `${lib}:${taskId}`;
}

export async function rememberTaskMessage(taskId: number, lib: LibraryType, message: string) {
  const state = await load();
  const key = makeKey(taskId, lib);
  state[key] = { lastMessage: message, updatedAt: Date.now() };
  cache = state;
  await persist();
}

export async function getTaskMemory(taskId: number, lib: LibraryType) {
  const state = await load();
  return state[makeKey(taskId, lib)] || null;
}

export function resetTaskMemoryCache() {
  cache = null;
}
