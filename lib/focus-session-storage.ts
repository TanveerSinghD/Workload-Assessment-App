import * as SecureStore from "@/lib/secure-store";

export type FocusSessionState = "ready" | "running" | "paused" | "finished";

export type FocusSessionSnapshot = {
  taskId: number | null;
  selectedMinutes: number;
  remainingSeconds: number;
  sessionState: FocusSessionState;
  updatedAt: number;
};

const FOCUS_SESSION_KEY = "focus_session_snapshot_v1";

export async function loadFocusSessionSnapshot(): Promise<FocusSessionSnapshot | null> {
  try {
    const raw = await SecureStore.getItemAsync(FOCUS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FocusSessionSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (error) {
    console.warn("Failed to load focus session snapshot", error);
    return null;
  }
}

export async function saveFocusSessionSnapshot(snapshot: FocusSessionSnapshot) {
  try {
    await SecureStore.setItemAsync(FOCUS_SESSION_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Failed to save focus session snapshot", error);
  }
}

export async function clearFocusSessionSnapshot() {
  try {
    await SecureStore.deleteItemAsync(FOCUS_SESSION_KEY);
  } catch (error) {
    console.warn("Failed to clear focus session snapshot", error);
  }
}
