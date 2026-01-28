import * as SecureStore from "expo-secure-store";
import { Text } from "react-native";

const FONT_SCALE_KEY = "access_font_scale";
const HAPTICS_KEY = "access_haptics_enabled";
const COLORBLIND_KEY = "access_colorblind_mode";

export type AccessibilityPrefs = {
  fontScale: number; // 1.0 default
  hapticsEnabled: boolean; // true default
  colorBlindMode: boolean; // false default
};

let prefs: AccessibilityPrefs = {
  fontScale: 1,
  hapticsEnabled: true,
  colorBlindMode: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export function subscribeAccessibility(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessibilitySnapshot() {
  return prefs;
}

export function applyFontScale(fontScale: number) {
  Text.defaultProps = Text.defaultProps || {};
  Text.defaultProps.maxFontSizeMultiplier = fontScale;
}

export async function loadAccessibilityPrefs(): Promise<AccessibilityPrefs> {
  const [fontRaw, hapticsRaw, colorRaw] = await Promise.all([
    SecureStore.getItemAsync(FONT_SCALE_KEY),
    SecureStore.getItemAsync(HAPTICS_KEY),
    SecureStore.getItemAsync(COLORBLIND_KEY),
  ]);

  prefs = {
    fontScale: fontRaw ? Number(fontRaw) : 1,
    hapticsEnabled: hapticsRaw === null ? true : hapticsRaw === "true",
    colorBlindMode: colorRaw === "true",
  };
  applyFontScale(prefs.fontScale);
  emit();
  return prefs;
}

export async function setFontScale(fontScale: number) {
  prefs.fontScale = fontScale;
  applyFontScale(fontScale);
  await SecureStore.setItemAsync(FONT_SCALE_KEY, String(fontScale));
  emit();
}

export async function setHapticsEnabled(enabled: boolean) {
  prefs.hapticsEnabled = enabled;
  await SecureStore.setItemAsync(HAPTICS_KEY, enabled ? "true" : "false");
  emit();
}

export async function setColorBlindMode(enabled: boolean) {
  prefs.colorBlindMode = enabled;
  await SecureStore.setItemAsync(COLORBLIND_KEY, enabled ? "true" : "false");
  emit();
}

export function isHapticsEnabledSync() {
  return prefs.hapticsEnabled;
}

export function isColorBlindModeSync() {
  return prefs.colorBlindMode;
}
