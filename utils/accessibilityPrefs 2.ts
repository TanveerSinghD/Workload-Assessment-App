import * as SecureStore from "expo-secure-store";
import { Text } from "react-native";

const FONT_SCALE_KEY = "access_font_scale";
const HAPTICS_KEY = "access_haptics_enabled";

type Prefs = {
  fontScale: number;
  hapticsEnabled: boolean;
};

let hapticsCached: boolean | null = null;

export async function loadAccessibilityPrefs(): Promise<Prefs> {
  const fontRaw = await SecureStore.getItemAsync(FONT_SCALE_KEY);
  const hapticsRaw = await SecureStore.getItemAsync(HAPTICS_KEY);
  const fontScale = fontRaw ? Number(fontRaw) : 1;
  const hapticsEnabled = hapticsRaw === null ? true : hapticsRaw === "true";
  applyFontScale(fontScale);
  hapticsCached = hapticsEnabled;
  return { fontScale, hapticsEnabled };
}

export async function setFontScale(fontScale: number) {
  await SecureStore.setItemAsync(FONT_SCALE_KEY, String(fontScale));
  applyFontScale(fontScale);
}

export function applyFontScale(fontScale: number) {
  Text.defaultProps = Text.defaultProps || {};
  Text.defaultProps.maxFontSizeMultiplier = fontScale;
}

export async function setHapticsEnabled(enabled: boolean) {
  hapticsCached = enabled;
  await SecureStore.setItemAsync(HAPTICS_KEY, enabled ? "true" : "false");
}

export async function isHapticsEnabled(): Promise<boolean> {
  if (hapticsCached !== null) return hapticsCached;
  const raw = await SecureStore.getItemAsync(HAPTICS_KEY);
  hapticsCached = raw === null ? true : raw === "true";
  return hapticsCached;
}
