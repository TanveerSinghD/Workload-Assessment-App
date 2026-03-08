import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  email: string | null;
  onBack: () => void;
  onSubmit: (password: string) => Promise<string | null>;
};

export function PinRecoveryScreen({ email, onBack, onSubmit }: Props) {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const colors = useMemo(
    () => ({
      background: dark ? "#0F1117" : "#EEF1F7",
      card: dark ? "#171B24" : "#FFFFFF",
      text: dark ? "#F5F7FB" : "#12151C",
      muted: dark ? "#9BA5B7" : "#677285",
      border: dark ? "rgba(255,255,255,0.12)" : "rgba(10,22,70,0.10)",
      accent: dark ? "#7CB5FF" : "#0A84FF",
      danger: "#FF3B30",
      fieldBg: dark ? "#212836" : "#F4F6FA",
      fieldBorder: dark ? "rgba(255,255,255,0.16)" : "#DCE3EC",
    }),
    [dark]
  );

  const handleContinue = async () => {
    if (submitting) return;
    if (!password.trim()) {
      setError("Enter your account password.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await onSubmit(password);
    setSubmitting(false);
    if (result) setError(result);
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: `${colors.accent}20` }]}>
              <Ionicons name="key-outline" size={18} color={colors.accent} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.accent }]}>Forgot PIN Recovery</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Verify account password</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Enter your account password to continue and set a new PIN.
          </Text>
          {email ? <Text style={[styles.email, { color: colors.muted }]}>{email}</Text> : null}

          <View style={styles.form}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Account password"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.fieldBg,
                  borderColor: error ? colors.danger : colors.fieldBorder,
                },
              ]}
            />
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={onBack}
              style={[styles.secondaryBtn, { borderColor: colors.fieldBorder }]}
              disabled={submitting}
            >
              <Text style={[styles.secondaryText, { color: colors.muted }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleContinue}
              style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Continue</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  card: {
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  header: {
    alignItems: "center",
    marginBottom: 10,
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
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  email: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  form: {
    marginTop: 16,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
  },
  actionRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
