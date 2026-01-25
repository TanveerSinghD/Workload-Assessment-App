import { useColorScheme } from "@/hooks/use-color-scheme";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
  error?: string | null;
  onSubmit: (pin: string) => Promise<void> | void;
  submitLabel?: string;
  submitDisabled?: boolean;
  showCancel?: boolean;
  onCancel?: () => void;
  resetSignal?: number; // increment to force clearing digits from parent
};

const DIGIT_ROWS: (string | null)[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [null, "0", "delete"],
];

export function PasscodeKeypad({
  title,
  subtitle,
  error,
  onSubmit,
  submitLabel = "Enter",
  submitDisabled,
  showCancel = false,
  onCancel,
  resetSignal,
}: Props) {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const [digits, setDigits] = useState("");

  const colors = useMemo(
    () => ({
      background: "transparent",
      card: dark ? "#1C1C1E" : "#FFFFFF",
      text: dark ? "#FFFFFF" : "#000000",
      muted: dark ? "#A1A1A5" : "#6B6B6B",
      accent: "#0A84FF",
      error: "#FF3B30",
      button: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      buttonBorder: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    }),
    [dark]
  );

  useEffect(() => {
    // Parent asked to clear digits (e.g., mismatch or flow reset)
    setDigits("");
  }, [resetSignal]);

  const handleDigit = (d: string) => {
    if (digits.length >= 6) return;
    setDigits((prev) => prev + d);
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleDelete = () => {
    setDigits((prev) => prev.slice(0, -1));
  };

  const dots = Array.from({ length: 6 }, (_, i) => i < digits.length);
  const isSubmitEnabled = digits.length === 6 && !submitDisabled;
  const handleSubmit = () => {
    if (!isSubmitEnabled) return;
    void onSubmit(digits);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}

      <View style={styles.dotsRow}>
        {dots.map((filled, idx) => (
          <View key={idx} style={[styles.dotBox, { borderColor: colors.muted }]}>
            {filled ? <View style={[styles.dotFill, { backgroundColor: colors.text }]} /> : null}
          </View>
        ))}
      </View>

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <View style={styles.grid}>
        {DIGIT_ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((item, idx) => {
              if (item === null) {
                // Empty cell; use Cancel if requested and space available
                if (showCancel && rowIdx === DIGIT_ROWS.length - 1 && idx === 0) {
                  return (
                    <TouchableOpacity
                      key="cancel"
                      style={styles.textButton}
                      onPress={onCancel}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.textButtonLabel, { color: colors.muted }]}>Cancel</Text>
                    </TouchableOpacity>
                  );
                }
                return <View key={`empty-${idx}`} style={styles.placeholder} />;
              }

              if (item === "delete") {
                return (
                  <TouchableOpacity
                    key="delete"
                    style={styles.textButton}
                    onPress={handleDelete}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.textButtonLabel, { color: colors.muted }]}>Delete</Text>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.key,
                    {
                      backgroundColor: colors.button,
                      borderColor: colors.buttonBorder,
                    },
                  ]}
                  activeOpacity={0.65}
                  onPress={() => handleDigit(item)}
                >
                  <Text style={[styles.keyLabel, { color: colors.text }]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          {
            backgroundColor: isSubmitEnabled ? colors.accent : colors.button,
            borderColor: colors.buttonBorder,
            opacity: isSubmitEnabled ? 1 : 0.6,
          },
        ]}
        activeOpacity={isSubmitEnabled ? 0.8 : 1}
        disabled={!isSubmitEnabled}
        onPress={handleSubmit}
      >
        <Text style={[styles.primaryText, { color: isSubmitEnabled ? "#fff" : colors.muted }]}>{submitLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  dotBox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dotFill: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  error: {
    fontSize: 14,
    marginTop: 4,
  },
  grid: {
    width: "100%",
    marginTop: 16,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  keyLabel: {
    fontSize: 26,
    fontWeight: "700",
  },
  textButton: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  textButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  placeholder: {
    width: 76,
    height: 76,
  },
  primaryBtn: {
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    alignSelf: "stretch",
  },
  primaryText: {
    fontSize: 17,
    fontWeight: "700",
  },
});
