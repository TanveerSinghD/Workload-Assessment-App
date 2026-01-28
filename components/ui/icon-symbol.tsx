// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, StyleProp, TextStyle } from "react-native";

// Minimal mapping from SF Symbol names (used throughout the app) to Material icons for Android/web.
const MATERIAL_MAPPING: Record<string, ComponentProps<typeof MaterialIcons>["name"]> = {
  "house.fill": "home",
  checklist: "checklist",
  "checkmark.circle": "check-circle",
  "checkmark.circle.fill": "check-circle",
  "pencil.and.outline": "edit",
  calendar: "calendar-today",
  "gearshape.fill": "settings",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
};

const FALLBACK_ICON: ComponentProps<typeof MaterialIcons>["name"] = "help-outline";

function toMaterialName(name: string) {
  return MATERIAL_MAPPING[name] ?? FALLBACK_ICON;
}

/**
 * Cross‑platform icon helper: uses Material icons on Android/Web.
 * iOS has a dedicated .ios.tsx variant that uses SF Symbols.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  // kept for API compatibility; ignored on this platform
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={toMaterialName(name)} style={style} />;
}
