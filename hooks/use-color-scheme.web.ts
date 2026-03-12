import { useEffect } from 'react';
import { useThemeOverride } from './useThemeOverride';

export function useColorScheme() {
  const { themeOverride } = useThemeOverride();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const mode = themeOverride ?? 'light';
    document.documentElement.style.colorScheme = mode;
    document.documentElement.style.backgroundColor = mode === 'dark' ? '#0E1016' : '#F7F8FA';
    document.body.style.backgroundColor = mode === 'dark' ? '#0E1016' : '#F7F8FA';
  }, [themeOverride]);

  return themeOverride ?? 'light';
}
