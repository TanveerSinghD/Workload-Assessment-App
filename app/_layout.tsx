import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ThemeOverrideProvider, useThemeOverride } from '@/hooks/useThemeOverride';
import { AppLockGate } from "@/components/app-lock-gate";

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeOverrideProvider>
        <RootLayoutWithTheme />
      </ThemeOverrideProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutWithTheme() {
  const colorScheme = useColorScheme();
  const { isReady } = useThemeOverride();

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colorScheme === 'dark' ? '#0E1016' : '#F7F8FA',
        }}
      >
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#FFF' : '#000'} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppLockGate>
          <RootNavigator />
        </AppLockGate>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </AuthProvider>
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "", headerBackTitle: "" }} />
        <Stack.Screen name="add-assignment" options={{ title: "Add Task", headerBackTitle: "" }} />
        <Stack.Screen name="edit-task" options={{ title: "Edit Task", headerBackTitle: "" }} />
        <Stack.Screen name="completed-tasks" options={{ title: "Completed Tasks", headerBackTitle: "" }} />
        <Stack.Screen name="tasks-difficulty" options={{ title: "", headerBackTitle: "" }} />
        <Stack.Screen name="tasks-filter" options={{ title: "", headerBackTitle: "" }} />
      <Stack.Screen name="nav-quick-actions" options={{ title: "Nav Quick Actions", headerBackTitle: "" }} />
      <Stack.Screen name="set-pin" options={{ title: "Set PIN", headerBackTitle: "" }} />
      <Stack.Screen name="disable-app-lock" options={{ title: "Disable App Lock", headerBackTitle: "" }} />
      <Stack.Screen name="change-pin" options={{ title: "Change PIN", headerBackTitle: "" }} />
      <Stack.Screen name="account" options={{ title: "Account", headerBackTitle: "" }} />
      <Stack.Screen name="theme-settings" options={{ title: "Theme", headerBackTitle: "" }} />
      <Stack.Screen name="plan-section" options={{ title: "", headerBackTitle: "" }} />
      <Stack.Screen name="focus-session" options={{ headerShown: false, title: "Focus Session", headerBackTitle: "" }} />
      <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal", headerBackTitle: "" }} />
    </Stack>
  );
}
