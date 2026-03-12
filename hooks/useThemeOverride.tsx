import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { AccentTheme } from "@/constants/accent-theme";
import * as SecureStore from "@/lib/secure-store";

type ThemeOverride = "light" | "dark" | null;
const THEME_STORAGE_KEY = "theme_override_v1";
const ACCENT_STORAGE_KEY = "accent_theme_v1";

interface ThemeContextProps {
  themeOverride: ThemeOverride;
  setThemeOverride: (theme: ThemeOverride) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (theme: AccentTheme) => void;
  isReady: boolean;
}

const ThemeContext = createContext<ThemeContextProps>({
  themeOverride: null,
  setThemeOverride: () => {},
  accentTheme: "blue",
  setAccentTheme: () => {},
  isReady: false,
});

export function ThemeOverrideProvider({ children }: { children: ReactNode }) {
  const [themeOverride, setThemeOverrideState] = useState<ThemeOverride>(null);
  const [accentTheme, setAccentThemeState] = useState<AccentTheme>("blue");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let storedTheme: string | null = null;
        let storedAccent: string | null = null;
        if (Platform.OS === "web") {
          if (typeof window !== "undefined") {
            storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
            storedAccent = window.localStorage.getItem(ACCENT_STORAGE_KEY);
          }
        } else {
          const [savedTheme, savedAccent] = await Promise.all([
            SecureStore.getItemAsync(THEME_STORAGE_KEY),
            SecureStore.getItemAsync(ACCENT_STORAGE_KEY),
          ]);
          storedTheme = savedTheme;
          storedAccent = savedAccent;
        }

        if (!mounted) return;
        setThemeOverrideState(storedTheme === "light" || storedTheme === "dark" ? storedTheme : null);
        setAccentThemeState(
          storedAccent === "blue" ||
            storedAccent === "teal" ||
            storedAccent === "green" ||
            storedAccent === "orange" ||
            storedAccent === "purple" ||
            storedAccent === "pink"
            ? storedAccent
            : "blue"
        );
      } catch (error) {
        if (__DEV__) console.warn("Failed to load theme override", error);
      } finally {
        if (mounted) setIsReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setThemeOverride = useCallback((theme: ThemeOverride) => {
    setThemeOverrideState(theme);
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      if (theme) window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      else window.localStorage.removeItem(THEME_STORAGE_KEY);
      return;
    }

    const persist = async () => {
      try {
        if (theme) await SecureStore.setItemAsync(THEME_STORAGE_KEY, theme);
        else await SecureStore.deleteItemAsync(THEME_STORAGE_KEY);
      } catch (error) {
        if (__DEV__) console.warn("Failed to persist theme override", error);
      }
    };
    void persist();
  }, []);

  const setAccentTheme = useCallback((theme: AccentTheme) => {
    setAccentThemeState(theme);
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(ACCENT_STORAGE_KEY, theme);
      return;
    }

    const persist = async () => {
      try {
        await SecureStore.setItemAsync(ACCENT_STORAGE_KEY, theme);
      } catch (error) {
        if (__DEV__) console.warn("Failed to persist accent theme", error);
      }
    };
    void persist();
  }, []);

  return (
    <ThemeContext.Provider value={{ themeOverride, setThemeOverride, accentTheme, setAccentTheme, isReady }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useThemeOverride = () => useContext(ThemeContext);
