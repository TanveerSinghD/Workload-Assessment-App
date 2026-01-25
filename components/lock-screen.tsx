import { PasscodeKeypad } from "@/components/passcode-keypad";
import { useColorScheme } from "@/hooks/use-color-scheme";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  onUnlock: (pin: string) => Promise<boolean>;
  onResetPin: () => void;
  missingPin?: boolean;
};

export function LockScreen({ onUnlock, onResetPin, missingPin }: Props) {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const [error, setError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  const colors = useMemo(
    () => ({
      background: dark ? "#0F1117" : "#F5F6FA",
      card: dark ? "#1C1C1E" : "#FFFFFF",
    }),
    [dark]
  );

  const handleSubmit = async (pin: string) => {
    const ok = await onUnlock(pin);
    if (!ok) {
      setError("Incorrect PIN");
      setResetSignal((n) => n + 1);
      if (process.env.EXPO_OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } else {
      setError(null);
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <PasscodeKeypad
          title={missingPin ? "Set a new Passcode" : "Enter Passcode"}
          subtitle={missingPin ? "We need a new PIN to secure your app." : "Enter your 6-digit PIN to continue."}
          error={error}
          onSubmit={handleSubmit}
          submitLabel="Enter"
          showCancel={!!missingPin}
          onCancel={onResetPin}
          resetSignal={resetSignal}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    padding: 20,
  },
});
