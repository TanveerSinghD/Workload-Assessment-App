import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeOverrideProvider } from '@/hooks/useThemeOverride';
import { initDatabase } from './database/database';

export const unstable_settings = {
  anchor: '(tabs)', // this is fine
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

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

          {/* COMPLETED TASKS */}
          <Stack.Screen
            name="completed-tasks"
            options={{
              title: "Completed Tasks",
              headerBackTitle: "",
            }}
          />

          {/* DIFFICULTY LIST */}
          <Stack.Screen
            name="tasks-difficulty"
            options={{
              title: "",
              headerBackTitle: "",
            }}
          />

          {/* FILTERED TASKS */}
          <Stack.Screen
            name="tasks-filter"
            options={{
              title: "",
              headerBackTitle: "",
            }}
          />

          {/* PLAN SECTION */}
          <Stack.Screen
            name="plan-section"
            options={{
              title: "",
              headerBackTitle: "",
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
