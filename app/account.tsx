import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColors } from "../hooks/use-theme-colors";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LockScreen } from "@/components/lock-screen";
import { getAppLockState, verifyPin } from "@/lib/app-lock-storage";

export default function AccountScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const colors = useThemeColors();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [missingPin, setMissingPin] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);

  const background = colors.background;
  const card = colors.surface;
  const text = colors.textPrimary;
  const subtext = colors.textMuted;

  const handleSignOut = () => {
    Alert.alert(
      "Sign out?",
      "You'll need to log back in to see your tasks.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            try {
              setSigningOut(true);
              await signOut();
              router.replace("/login");
            } finally {
              setSigningOut(false);
            }
          },
        },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  };

  const refreshLockState = useCallback(async () => {
    setCheckingLock(true);
    const state = await getAppLockState();
    const missing = state.enabled && (!state.pinHash || !state.salt);
    setMissingPin(missing);
    setLockEnabled(state.enabled);
    setCheckingLock(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshLockState();
    }, [refreshLockState])
  );

  const handleUnlock = useCallback(async (pin: string) => {
    const ok = await verifyPin(pin);
    if (ok) {
      setLockEnabled(false);
      setMissingPin(false);
      return true;
    }
    return false;
  }, []);

  const handleResetPin = useCallback(() => {
    setLockEnabled(false);
    setMissingPin(false);
    router.replace("/set-pin");
  }, []);

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: background }}>
      <Stack.Screen
        options={{
          title: "Account",
          headerBackTitle: "",
        }}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 20 }}>
        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.sectionLabel, { color: subtext }]}>Account</Text>

          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Name</Text>
            <Text style={[styles.value, { color: subtext }]}>{user?.name || "Not set"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Email</Text>
            <Text style={[styles.value, { color: subtext }]}>{user?.email || "—"}</Text>
          </View>

          <TouchableOpacity style={styles.row} onPress={handleSignOut} disabled={signingOut} activeOpacity={0.85}>
            <Text style={[styles.label, { color: "#FF3B30" }]}>
              {signingOut ? "Signing out..." : "Sign Out"}
            </Text>
            {signingOut && <ActivityIndicator color="#FF3B30" />}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {(lockEnabled || missingPin) && (
        <View style={[styles.lockOverlay, { backgroundColor: background }]}>
          {!checkingLock && (
            <LockScreen
              missingPin={missingPin}
              onUnlock={handleUnlock}
              onResetPin={handleResetPin}
              onForgotPin={handleResetPin}
            />
          )}
          {checkingLock && (
            <View style={{ alignItems: "center", justifyContent: "center", padding: 20 }}>
              <ActivityIndicator />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 24,
    paddingVertical: 8,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 6,
    marginLeft: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  label: { fontSize: 16 },
  value: { fontSize: 14, opacity: 0.8 },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
});
