import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ThemeOverrideProvider } from '@/hooks/useThemeOverride';
import { AppLockGate } from "@/components/app-lock-gate";

export const unstable_settings = {
  anchor: '(tabs)', // this is fine
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeOverrideProvider>
        <AuthProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AppLockGate>
              <RootNavigator />
            </AppLockGate>
            <StatusBar style="auto" />
          </ThemeProvider>
        </AuthProvider>
      </ThemeOverrideProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, color: colorScheme === 'dark' ? '#fff' : '#000' }}>
          Loading account...
        </Text>
      </View>
    );
  }

  // Not authenticated: only show login screen
  if (!user) {
    return (
      <Stack>
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    );
  }

  return (
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

      {/* NAV QUICK ACTIONS */}
      <Stack.Screen
        name="nav-quick-actions"
        options={{
          title: "Nav Quick Actions",
          headerBackTitle: "",
        }}
      />

      {/* SET PIN */}
      <Stack.Screen
        name="set-pin"
        options={{
          title: "Set PIN",
          headerBackTitle: "",
        }}
      />

      {/* DISABLE APP LOCK */}
      <Stack.Screen
        name="disable-app-lock"
        options={{
          title: "Disable App Lock",
          headerBackTitle: "",
        }}
      />

      {/* CHANGE PIN */}
      <Stack.Screen
        name="change-pin"
        options={{
          title: "Change PIN",
          headerBackTitle: "",
        }}
      />

      {/* ACCOUNT SETTINGS */}
      <Stack.Screen
        name="account"
        options={{
          title: "Account",
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

      {/* FOCUS SESSION */}
      <Stack.Screen
        name="focus-session"
        options={{
          headerShown: false,
          title: "Focus Session",
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
  );
}
