import { useEffect, useState } from "react";
import { Appearance } from "react-native";
import { useThemeOverride } from './useThemeOverride';

export function useColorScheme() {
  const { themeOverride } = useThemeOverride();

  const [systemTheme, setSystemTheme] = useState(
    Appearance.getColorScheme() ?? "light"
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme ?? "light");
    });

    return () => sub.remove();
  }, []);

  return themeOverride || systemTheme;
}
