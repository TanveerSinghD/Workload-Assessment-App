import { createContext, ReactNode, useContext, useState } from "react";

type ThemeOverride = "light" | "dark" | null;

interface ThemeContextProps {
  themeOverride: ThemeOverride;
  setThemeOverride: (theme: ThemeOverride) => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  themeOverride: null,
  setThemeOverride: () => {},
});

export function ThemeOverrideProvider({ children }: { children: ReactNode }) {
  const [themeOverride, setThemeOverride] = useState<ThemeOverride>(null);

  return (
    <ThemeContext.Provider value={{ themeOverride, setThemeOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useThemeOverride = () => useContext(ThemeContext);
