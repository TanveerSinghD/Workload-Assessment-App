import { useColorScheme } from "./use-color-scheme";
import { getPalette, ThemePalette } from "@/constants/theme";

export function useThemeColors(): ThemePalette {
  const scheme = useColorScheme();
  return getPalette(scheme);
}
