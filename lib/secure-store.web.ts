function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export async function getItemAsync(key: string) {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(key);
}

export async function setItemAsync(key: string, value: string) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, value);
}

export async function deleteItemAsync(key: string) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(key);
}
