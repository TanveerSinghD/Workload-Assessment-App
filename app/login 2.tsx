import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/useAuth";

export default function LoginScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const { user, signIn, signUp, loading } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const colors = useMemo(
    () =>
      dark
        ? ["#0f172a", "#111827", "#0b1324"]
        : ["#eef2ff", "#e0e7ff", "#e5e7eb"],
    [dark]
  );

  const resetCredentials = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  useEffect(() => {
    if (user) {
      router.replace("/(tabs)");
    }
  }, [user]);

  const validateEmail = (value: string) => value.trim().includes("@");
  const validatePassword = (value: string) => value.trim().length >= 6;

  const handlePrimary = async () => {
    if (submitting) return;
    if (!email || !password || (mode === "signup" && !name)) {
      Alert.alert("Missing info", "Please fill in all fields.");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Invalid email", "Please enter a valid email that includes '@'.");
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      Alert.alert("Passwords don't match", "Please re-type your password to confirm.");
      return;
    }

    setSubmitting(true);
    const ok =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(name, email, password);
    setSubmitting(false);

    if (!ok) {
      if (mode === "login") {
        Alert.alert("Login failed", "Your details are wrong. Please try again.");
        resetCredentials();
      }
      return;
    }

    router.replace("/(tabs)");
  };

  const cardBackground = dark ? "#0b1220" : "#ffffff";
  const muted = dark ? "#9ca3af" : "#6b7280";
  const text = dark ? "#e5e7eb" : "#0f172a";

  return (
    <LinearGradient colors={colors} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.wrapper}>
            <View style={styles.hero}>
              <Text style={[styles.title, { color: text }]}>Welcome</Text>
              <Text style={[styles.subtitle, { color: muted }]}>
                Log in to keep tasks, completions, and plans tied to your account.
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: cardBackground }]}>
              <View style={styles.toggleRow}>
                {(["login", "signup"] as const).map((tab) => {
                  const active = mode === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[
                        styles.toggle,
                        {
                          backgroundColor: active
                            ? dark
                              ? "#111827"
                              : "#e0e7ff"
                            : "transparent",
                        },
                      ]}
                      onPress={() => setMode(tab)}
                    >
                      <Text
                        style={[
                          styles.toggleLabel,
                          { color: active ? text : muted },
                        ]}
                      >
                        {tab === "login" ? "Log in" : "Sign up"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {mode === "signup" && (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: muted }]}>Full name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Hana Lee"
                    placeholderTextColor={muted}
                    style={[styles.input, { color: text, borderColor: muted }]}
                  />
                </View>
              )}

              <View style={styles.field}>
                <Text style={[styles.label, { color: muted }]}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { color: text, borderColor: muted }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: muted }]}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={muted}
                  secureTextEntry
                  style={[styles.input, { color: text, borderColor: muted }]}
                />
              </View>

              {mode === "signup" && (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: muted }]}>Confirm password</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-type password"
                    placeholderTextColor={muted}
                    secureTextEntry
                    style={[styles.input, { color: text, borderColor: muted }]}
                  />
                </View>
              )}

              <TouchableOpacity
                onPress={handlePrimary}
                disabled={submitting || loading}
                style={[
                  styles.primary,
                  {
                    backgroundColor: submitting ? "#9ca3af" : "#6366f1",
                    opacity: submitting ? 0.8 : 1,
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryLabel}>
                    {mode === "login" ? "Log in" : "Create account"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  hero: {
    marginTop: 26,
    marginBottom: 18,
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  toggle: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  field: {
    marginTop: 10,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  primary: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
