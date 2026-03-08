import { PasscodeKeypad } from "@/components/passcode-keypad";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  onUnlock: (pin: string) => Promise<boolean>;
  onResetPin: () => void;
  onForgotPin: () => void;
  missingPin?: boolean;
  attemptsRemaining?: number;
  maxAttempts?: number;
  lockoutUntil?: number | null;
};

export function LockScreen({
  onUnlock,
  onResetPin,
  onForgotPin,
  missingPin,
  attemptsRemaining,
  maxAttempts = 5,
  lockoutUntil,
}: Props) {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const [error, setError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    if (!lockoutUntil || lockoutUntil <= Date.now()) return;
    const interval = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const colors = useMemo(
    () => ({
      background: dark ? "#0F1117" : "#EEF1F7",
      card: dark ? "#171B24" : "#FFFFFF",
      muted: dark ? "#A1A1A5" : "#6B6B6B",
      accent: dark ? "#7CB5FF" : "#0A84FF",
      danger: "#FF3B30",
      border: dark ? "rgba(255,255,255,0.12)" : "rgba(10,22,70,0.10)",
      iconBg: dark ? "rgba(124,181,255,0.16)" : "rgba(10,132,255,0.12)",
    }),
    [dark]
  );

  const lockoutRemainingSeconds =
    lockoutUntil && lockoutUntil > clockNow ? Math.ceil((lockoutUntil - clockNow) / 1000) : 0;
  const isLockedOut = lockoutRemainingSeconds > 0;

  const statusMessage = isLockedOut
    ? `Too many tries. Try again in ${lockoutRemainingSeconds}s.`
    : typeof attemptsRemaining === "number" && attemptsRemaining < maxAttempts
    ? `${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining before lockout.`
    : null;

  const handleSubmit = async (pin: string) => {
    if (isLockedOut) return;
    const ok = await onUnlock(pin);
    if (!ok) {
      setError("Incorrect PIN");
      setResetSignal((n) => n + 1);
      return;
    }
    setError(null);
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.iconBg }]}>
            <Ionicons name="lock-closed" size={18} color={colors.accent} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.accent }]}>App Lock</Text>
        </View>

        <PasscodeKeypad
          title={missingPin ? "Set a new passcode" : "Enter passcode"}
          subtitle={
            missingPin
              ? "Your old PIN is missing. Create a new 6-digit passcode to secure the app."
              : "Enter your 6-digit passcode to continue."
          }
          error={error}
          onSubmit={handleSubmit}
          submitLabel="Enter"
          showCancel={!!missingPin}
          onCancel={onResetPin}
          resetSignal={resetSignal}
          statusMessage={statusMessage}
          inputDisabled={isLockedOut}
        />

        {!missingPin ? (
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: `${colors.danger}44` }]}
              onPress={onForgotPin}
              accessibilityRole="button"
              accessibilityLabel="Forgot passcode"
            >
              <Text style={[styles.secondaryText, { color: colors.danger }]}>Forgot PIN?</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!missingPin ? (
          <Text style={[styles.recoveryHint, { color: colors.muted }]}>
            Forgot PIN will open account password verification before you set a new PIN.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 22,
    justifyContent: "center",
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
  secondaryActions: {
    marginTop: 10,
    gap: 10,
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: "700",
  },
  recoveryHint: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 12,
  },
});
