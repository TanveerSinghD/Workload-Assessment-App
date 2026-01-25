import { useColorScheme } from "@/hooks/use-color-scheme";
import { PasscodeKeypad } from "@/components/passcode-keypad";
import { setAppLockEnabled, setPinHash } from "@/lib/app-lock-storage";
import { Stack, router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

export default function SetPinScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  const colors = useMemo(
    () => ({
      background: dark ? "#1C1C1E" : "#F5F6FA",
      card: dark ? "#2C2C2E" : "#FFFFFF",
      text: dark ? "#FFFFFF" : "#000000",
      muted: dark ? "#A1A1A5" : "#6B6B6B",
      accent: "#0A84FF",
      error: "#FF3B30",
    }),
    [dark]
  );

  const handleSubmit = async (pin: string) => {
    setError(null);
    if (step === "enter") {
      setFirstPin(pin);
      setStep("confirm");
      setResetSignal((n) => n + 1);
      return;
    }

    if (pin !== firstPin) {
      setError("Passcodes did not match. Try again.");
      setFirstPin(null);
      setStep("enter");
      setResetSignal((n) => n + 1);
      return;
    }

    await setPinHash(pin);
    await setAppLockEnabled(true);
    router.back();
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Set PIN",
          headerBackTitle: "",
        }}
      />

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <PasscodeKeypad
          title={step === "enter" ? "Enter Passcode" : "Re-enter Passcode"}
          subtitle="Use a 6-digit PIN to lock the app."
          error={error}
          onSubmit={handleSubmit}
          submitLabel={step === "enter" ? "Next" : "Confirm"}
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
    gap: 12,
  },
});
