import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeOverrideProvider } from '@/hooks/useThemeOverride';

// ⭐ IMPORT DATABASE INIT
import { initDatabase } from './database/database';

export const unstable_settings = {
  anchor: '(tabs)', // this is fine
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // ⭐ INIT DB ONCE WHEN APP LOADS
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <ThemeOverrideProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>

          {/* MAIN TABS */}
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,     // hides header completely
              title: "",
              headerBackTitle: "",    // prevents "(tabs)" back text
            }}
          />

          {/* ADD ASSIGNMENT PAGE */}
          <Stack.Screen
            name="add-assignment"
            options={{
              title: "Add Task",
              headerBackTitle: "",    // clean back arrow only
            }}
          />

          {/* MODAL */}
          <Stack.Screen
            name="modal"
            options={{
              presentation: 'modal',
              title: 'Modal',
              headerBackTitle: "",
            }}
          />

        </Stack>

        <StatusBar style="auto" />
      </ThemeProvider>
    </ThemeOverrideProvider>
  );
}
