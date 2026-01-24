import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/useAuth";
import { Stack, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AccountScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const background = dark ? "#1C1C1E" : "#f2f2f7";
  const card = dark ? "#2C2C2E" : "#fff";
  const text = dark ? "#ffffff" : "#000";
  const subtext = dark ? "#D1D1D6" : "#555";

  const handleSignOut = () => {
    Alert.alert(
      "Sign out?",
      "You'll need to log back in to see your tasks.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            try {
              setSigningOut(true);
              await signOut();
              router.replace("/login");
            } finally {
              setSigningOut(false);
            }
          },
        },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  };

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: background }}>
      <Stack.Screen
        options={{
          title: "Account",
          headerBackTitle: "",
        }}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 20 }}>
        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.sectionLabel, { color: subtext }]}>Account</Text>

          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Name</Text>
            <Text style={[styles.value, { color: subtext }]}>{user?.name || "Not set"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Email</Text>
            <Text style={[styles.value, { color: subtext }]}>{user?.email || "—"}</Text>
          </View>

          <TouchableOpacity style={styles.row} onPress={handleSignOut} disabled={signingOut} activeOpacity={0.85}>
            <Text style={[styles.label, { color: "#FF3B30" }]}>
              {signingOut ? "Signing out..." : "Sign Out"}
            </Text>
            {signingOut && <ActivityIndicator color="#FF3B30" />}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 24,
    paddingVertical: 8,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 6,
    marginLeft: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  label: { fontSize: 16 },
  value: { fontSize: 14, opacity: 0.8 },
});
