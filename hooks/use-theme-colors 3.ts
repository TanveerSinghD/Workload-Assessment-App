import { getPalette, ThemePalette } from "@/constants/theme";
import { useColorScheme } from "./use-color-scheme";

export function useThemeColors(): ThemePalette {
  const scheme = useColorScheme();
  return getPalette(scheme);
}
