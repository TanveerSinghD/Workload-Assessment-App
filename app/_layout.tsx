import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ThemeOverrideProvider } from '@/hooks/useThemeOverride';

export const unstable_settings = {
  anchor: '(tabs)', // this is fine
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeOverrideProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </ThemeOverrideProvider>
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
  );
}
