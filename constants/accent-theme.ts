export type AccentTheme = "blue" | "teal" | "green" | "orange" | "purple" | "pink";

export type AccentThemeConfig = {
  id: AccentTheme;
  label: string;
  color: string;
  darkColor: string;
};

export const accentThemes: Record<AccentTheme, AccentThemeConfig> = {
  blue: { id: "blue", label: "Blue", color: "#0A84FF", darkColor: "#84BBFF" },
  teal: { id: "teal", label: "Teal", color: "#14B8A6", darkColor: "#5EEAD4" },
  green: { id: "green", label: "Green", color: "#22C55E", darkColor: "#86EFAC" },
  orange: { id: "orange", label: "Orange", color: "#F97316", darkColor: "#FDBA74" },
  purple: { id: "purple", label: "Purple", color: "#8B5CF6", darkColor: "#C4B5FD" },
  pink: { id: "pink", label: "Pink", color: "#EC4899", darkColor: "#F9A8D4" },
};

export const accentThemeList: AccentThemeConfig[] = [
  accentThemes.blue,
  accentThemes.teal,
  accentThemes.green,
  accentThemes.orange,
  accentThemes.purple,
  accentThemes.pink,
];

function normalizeHex(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    return cleaned
      .split("")
      .map((char) => char + char)
      .join("");
  }
  return cleaned;
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeHex(hex);
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
