import { PasscodeKeypad } from "@/components/passcode-keypad";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { setAppLockEnabled, verifyPin } from "@/lib/app-lock-storage";
import { Stack, router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

export default function DisableAppLockScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const [error, setError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  const colors = useMemo(
    () => ({
      background: dark ? "#1C1C1E" : "#F5F6FA",
      card: dark ? "#2C2C2E" : "#FFFFFF",
    }),
    [dark]
  );

  const handleSubmit = async (pin: string) => {
    const ok = await verifyPin(pin);
    if (!ok) {
      setError("Incorrect PIN");
      setResetSignal((n) => n + 1);
      return;
    }
    await setAppLockEnabled(false);
    router.back();
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Disable App Lock",
          headerBackTitle: "",
        }}
      />
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <PasscodeKeypad
          title="Enter Passcode"
          subtitle="Confirm to turn off App Lock."
          error={error}
          onSubmit={handleSubmit}
          submitLabel="Turn Off"
          showCancel
          onCancel={() => router.back()}
          resetSignal={resetSignal}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    padding: 20,
  },
});
