import { PasscodeKeypad } from "@/components/passcode-keypad";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { setPinHash, verifyPin } from "@/lib/app-lock-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

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
      accent: dark ? "#7CB5FF" : "#0A84FF",
      border: dark ? "rgba(255,255,255,0.12)" : "rgba(10,22,70,0.10)",
      iconBg: dark ? "rgba(124,181,255,0.16)" : "rgba(10,132,255,0.12)",
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
      void Haptics.selectionAsync();
      return;
    }

    if (stage === "new") {
      setPendingNew(pin);
      setStage("confirm");
      setResetSignal((n) => n + 1);
      void Haptics.selectionAsync();
      return;
    }

    // confirm stage
    if (pendingNew && pin === pendingNew) {
      await setPinHash(pin);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      ? "Step 1 of 3. Enter your current passcode."
      : stage === "new"
      ? "Step 2 of 3. Enter your new 6-digit passcode."
      : "Step 3 of 3. Re-enter to confirm.";

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Change PIN",
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
          title={title}
          subtitle={subtitle}
          error={error}
          onSubmit={handleSubmit}
          submitLabel={stage === "verify" ? "Next" : stage === "new" ? "Continue" : "Save PIN"}
          statusMessage={stage === "verify" ? null : "Use a 6-digit PIN and avoid obvious patterns."}
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
