import { getPalette, ThemePalette } from "@/constants/theme";
import { useColorScheme } from "./use-color-scheme";

// Returns the active theme palette for light/dark, used to unify colours.
export function useThemeColors(): ThemePalette {
  const scheme = useColorScheme();
  return getPalette(scheme);
}
