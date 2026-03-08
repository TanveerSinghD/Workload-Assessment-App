import { useColorScheme } from "@/hooks/use-color-scheme";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
  pinLength?: number;
  autoSubmit?: boolean;
  hideSubmitButton?: boolean;
  inputDisabled?: boolean;
  statusMessage?: string | null;
  securityNote?: string;
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
  pinLength = 6,
  autoSubmit = true,
  hideSubmitButton = true,
  inputDisabled = false,
  statusMessage,
  securityNote = "Your PIN is stored securely on this device.",
}: Props) {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const [digits, setDigits] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotAnimsRef = useRef<Animated.Value[]>([]);
  const lastAutoSubmittedPinRef = useRef<string | null>(null);
  const allowAutoSubmitRef = useRef(true);

  if (dotAnimsRef.current.length !== pinLength) {
    dotAnimsRef.current = Array.from({ length: pinLength }, (_, index) => {
      const filled = index < digits.length;
      return new Animated.Value(filled ? 1 : 0);
    });
  }

  const colors = useMemo(
    () => ({
      background: "transparent",
      text: dark ? "#FFFFFF" : "#000000",
      muted: dark ? "#A1A1A5" : "#6B6B6B",
      accent: "#0A84FF",
      error: "#FF3B30",
      button: dark ? "#262C39" : "#F2F4F8",
      buttonBorder: dark ? "rgba(255,255,255,0.18)" : "#DDE2EA",
      statusBg: dark ? "rgba(138,149,165,0.16)" : "rgba(107,107,107,0.08)",
      security: dark ? "#8E95A5" : "#5C6470",
    }),
    [dark]
  );

  useEffect(() => {
    setDigits("");
    setIsSubmitting(false);
    lastAutoSubmittedPinRef.current = null;
    allowAutoSubmitRef.current = false;
  }, [resetSignal]);

  useEffect(() => {
    dotAnimsRef.current.forEach((anim, index) => {
      const toValue = index < digits.length ? 1 : 0;
      Animated.timing(anim, {
        toValue,
        duration: 130,
        useNativeDriver: true,
      }).start();
    });
  }, [digits.length]);

  useEffect(() => {
    if (!error) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [error, shakeAnim]);

  const canSubmit =
    digits.length === pinLength && !submitDisabled && !isSubmitting && !inputDisabled;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    void Promise.resolve(onSubmit(digits)).finally(() => {
      setIsSubmitting(false);
    });
  }, [canSubmit, digits, onSubmit]);

  useEffect(() => {
    if (!autoSubmit || !canSubmit) return;
    if (!allowAutoSubmitRef.current) return;
    if (lastAutoSubmittedPinRef.current === digits) return;
    lastAutoSubmittedPinRef.current = digits;
    handleSubmit();
  }, [autoSubmit, canSubmit, digits, handleSubmit]);

  const handleDigit = (d: string) => {
    if (inputDisabled || isSubmitting || digits.length >= pinLength) return;
    allowAutoSubmitRef.current = true;
    lastAutoSubmittedPinRef.current = null;
    setDigits((prev) => prev + d);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = () => {
    if (inputDisabled || isSubmitting || digits.length === 0) return;
    allowAutoSubmitRef.current = true;
    lastAutoSubmittedPinRef.current = null;
    setDigits((prev) => prev.slice(0, -1));
    void Haptics.selectionAsync();
  };

  const handleClearAll = () => {
    if (inputDisabled || isSubmitting || digits.length === 0) return;
    allowAutoSubmitRef.current = true;
    lastAutoSubmittedPinRef.current = null;
    setDigits("");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          transform: [
            {
              translateX: shakeAnim.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-8, 0, 8],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}

      <View style={styles.dotsRow}>
        {dotAnimsRef.current.map((anim, idx) => (
          <View
            key={idx}
            style={[
              styles.dotBox,
              {
                borderColor: error ? colors.error : colors.muted,
                backgroundColor: error ? `${colors.error}18` : "transparent",
              },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Animated.View
              style={[
                styles.dotFill,
                {
                  backgroundColor: error ? colors.error : colors.text,
                  opacity: anim,
                  transform: [
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.72, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.statusWrap}>
        {error ? (
          <View style={styles.errorRow} accessibilityRole="alert">
            <View style={[styles.errorDot, { backgroundColor: colors.error }]} />
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          </View>
        ) : statusMessage ? (
          <View style={[styles.statusPill, { backgroundColor: colors.statusBg }]}>
            <Text style={[styles.statusText, { color: colors.muted }]}>{statusMessage}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.grid}>
        {DIGIT_ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((item, idx) => {
              if (item === null) {
                if (showCancel && rowIdx === DIGIT_ROWS.length - 1 && idx === 0) {
                  return (
                    <TouchableOpacity
                      key="cancel"
                      style={styles.textButton}
                      onPress={onCancel}
                      disabled={inputDisabled || isSubmitting}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel passcode entry"
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
                    onLongPress={handleClearAll}
                    delayLongPress={260}
                    disabled={inputDisabled || isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Delete last digit"
                    accessibilityHint="Long press to clear all digits"
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
                      opacity: inputDisabled ? 0.45 : 1,
                    },
                  ]}
                  activeOpacity={0.65}
                  onPress={() => handleDigit(item)}
                  disabled={inputDisabled || isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={`Digit ${item}`}
                >
                  <Text style={[styles.keyLabel, { color: colors.text }]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {!hideSubmitButton ? (
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            {
              backgroundColor: canSubmit ? colors.accent : colors.button,
              borderColor: colors.buttonBorder,
              opacity: canSubmit ? 1 : 0.6,
            },
          ]}
          activeOpacity={canSubmit ? 0.8 : 1}
          disabled={!canSubmit}
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
        >
          <Text style={[styles.primaryText, { color: canSubmit ? "#fff" : colors.muted }]}>{submitLabel}</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={[styles.securityNote, { color: colors.security }]}>{securityNote}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    alignSelf: "stretch",
    width: "100%",
    maxWidth: 430,
  },
  title: {
    fontSize: 23,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 330,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 10,
  },
  dotBox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotFill: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusWrap: {
    minHeight: 28,
    justifyContent: "center",
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  error: {
    fontSize: 14,
    fontWeight: "700",
  },
  grid: {
    width: "100%",
    marginTop: 8,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  key: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  keyLabel: {
    fontSize: 29,
    fontWeight: "700",
  },
  textButton: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  textButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  placeholder: {
    width: 84,
    height: 84,
  },
  primaryBtn: {
    marginTop: 8,
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
  securityNote: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
    maxWidth: 300,
  },
});
