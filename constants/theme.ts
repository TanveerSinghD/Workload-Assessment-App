import { Platform } from "react-native";

export type ThemePalette = {
  background: string;
  surface: string;
  surfaceElevated: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentBlue: string;
  successGreen: string;
  warningYellow: string;
  dangerRed: string;
  overlay: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
};

export const palettes: { light: ThemePalette; dark: ThemePalette } = {
  light: {
    background: "#F7F8FA",
    surface: "#FFFFFF",
    surfaceElevated: "#F2F4F8",
    borderSubtle: "rgba(0,0,0,0.08)",
    textPrimary: "#0A0A0C",
    textSecondary: "#3C3C43",
    textMuted: "#6B6B6C",
    accentBlue: "#0A84FF",
    successGreen: "#2ECC71",
    warningYellow: "#F7C948",
    dangerRed: "#FF3B30",
    overlay: "rgba(0,0,0,0.04)",
    tint: "#0A84FF",
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: "#0A84FF",
  },
  dark: {
    background: "#0E1016",
    surface: "#151922",
    surfaceElevated: "#1C2230",
    borderSubtle: "rgba(255,255,255,0.08)",
    textPrimary: "#F5F7FB",
    textSecondary: "#C5CBD8",
    textMuted: "#8E95A5",
    accentBlue: "#0A84FF",
    successGreen: "#2ECC71",
    warningYellow: "#F0C453",
    dangerRed: "#FF5E57",
    overlay: "rgba(0,0,0,0.35)",
    tint: "#0A84FF",
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: "#0A84FF",
  },
};

// Keep Expo's Colors export for backwards compatibility with Themed components
export const Colors = palettes;

export function getPalette(mode: "light" | "dark" | null | undefined): ThemePalette {
  return palettes[mode === "dark" ? "dark" : "light"];
}

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
