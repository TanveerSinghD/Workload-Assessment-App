import { useColorScheme } from "@/hooks/use-color-scheme";
import { PasscodeKeypad } from "@/components/passcode-keypad";
import { setAppLockEnabled, setPinHash } from "@/lib/app-lock-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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
      accent: dark ? "#7CB5FF" : "#0A84FF",
      error: "#FF3B30",
      border: dark ? "rgba(255,255,255,0.12)" : "rgba(10,22,70,0.10)",
      iconBg: dark ? "rgba(124,181,255,0.16)" : "rgba(10,132,255,0.12)",
    }),
    [dark]
  );

  const handleSubmit = async (pin: string) => {
    setError(null);
    if (step === "enter") {
      setFirstPin(pin);
      setStep("confirm");
      setResetSignal((n) => n + 1);
      void Haptics.selectionAsync();
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
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Set PIN",
          headerBackTitle: "",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.iconBg }]}>
            <Ionicons name="lock-closed" size={18} color={colors.accent} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.accent }]}>App Lock</Text>
        </View>

        <PasscodeKeypad
          title={step === "enter" ? "Create your passcode" : "Confirm your passcode"}
          subtitle={
            step === "enter"
              ? "Step 1 of 2. Enter a 6-digit passcode."
              : "Step 2 of 2. Re-enter the same 6 digits."
          }
          error={error}
          onSubmit={handleSubmit}
          submitLabel={step === "enter" ? "Next" : "Confirm"}
          statusMessage={step === "enter" ? "Use 6 digits for stronger security." : null}
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
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    justifyContent: "flex-start",
  },
  card: {
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  header: {
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
