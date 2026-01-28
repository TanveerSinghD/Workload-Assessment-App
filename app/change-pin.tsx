import { PasscodeKeypad } from "@/components/passcode-keypad";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { setPinHash, verifyPin } from "@/lib/app-lock-storage";
import { Stack, router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

type Stage = "verify" | "new" | "confirm";

export default function ChangePinScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const [stage, setStage] = useState<Stage>("verify");
  const [error, setError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [pendingNew, setPendingNew] = useState<string | null>(null);

  const colors = useMemo(
    () => ({
      background: dark ? "#0E1016" : "#F7F8FA",
      card: dark ? "#151922" : "#FFFFFF",
      text: dark ? "#F5F7FB" : "#0A0A0C",
      muted: dark ? "#8E95A5" : "#6B6B6C",
      accent: "#0A84FF",
    }),
    [dark]
  );

  const handleSubmit = async (pin: string) => {
    setError(null);

    if (stage === "verify") {
      const ok = await verifyPin(pin);
      if (!ok) {
        setError("Incorrect current PIN");
        setResetSignal((n) => n + 1);
        return;
      }
      setStage("new");
      setResetSignal((n) => n + 1);
      return;
    }

    if (stage === "new") {
      setPendingNew(pin);
      setStage("confirm");
      setResetSignal((n) => n + 1);
      return;
    }

    // confirm stage
    if (pendingNew && pin === pendingNew) {
      await setPinHash(pin);
      Alert.alert("PIN updated", "Your app lock PIN has been changed.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } else {
      setError("PINs did not match");
      setStage("new");
      setPendingNew(null);
      setResetSignal((n) => n + 1);
    }
  };

  const title =
    stage === "verify"
      ? "Enter current PIN"
      : stage === "new"
      ? "Set a new PIN"
      : "Confirm new PIN";

  const subtitle =
    stage === "verify"
      ? "We need your existing PIN to continue."
      : stage === "new"
      ? "Enter a 6-digit PIN."
      : "Re-enter to confirm.";

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Change PIN",
          headerBackTitle: "",
        }}
      />
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <PasscodeKeypad
          title={title}
          subtitle={subtitle}
          error={error}
          onSubmit={handleSubmit}
          submitLabel={stage === "verify" ? "Next" : stage === "new" ? "Continue" : "Save PIN"}
          resetSignal={resetSignal}
          showCancel
          onCancel={() => router.back()}
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
    padding: 16,
  },
});
