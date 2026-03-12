import * as ExpoSecureStore from "expo-secure-store";

export async function getItemAsync(key: string) {
  return ExpoSecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string) {
  return ExpoSecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string) {
  return ExpoSecureStore.deleteItemAsync(key);
}
