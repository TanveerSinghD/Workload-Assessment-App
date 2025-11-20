import { useColorScheme } from "@/hooks/use-color-scheme";
import { BlurView } from "expo-blur";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { deleteAllTasks } from "@/app/database/database";

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  // States
  const [notifications, setNotifications] = useState(true);
  const [appLock, setAppLock] = useState(false);

  // Colors
  const background = dark ? "#1C1C1E" : "#f2f2f7";
  const card = dark ? "#2C2C2E" : "#fff";
  const text = dark ? "#ffffff" : "#000";
  const subtext = dark ? "#D1D1D6" : "#555";

  /* DOUBLE CONFIRM DELETE FUNCTION */
  const clearAllData = () => {
    Alert.alert(
      "Are you sure?",
      "This will delete all tasks.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            // SECOND CONFIRMATION
            Alert.alert(
              "Really delete all tasks?",
              "This action cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    await deleteAllTasks();
                    console.log("All tasks deleted.");
                  },
                },
              ],
              { userInterfaceStyle: dark ? "dark" : "light" }
            );
          },
        },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: background }}>

      {/* 🔵 TOP BLUR EFFECT */}
      <BlurView
        intensity={40}
        tint={dark ? "dark" : "light"}
        style={styles.blurHeader}
      />

      {/* Smooth fade under blur */}
      <View style={styles.blurFade} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 26 }}
      >

        {/* TITLE */}
        <Text style={[styles.title, { color: text }]}></Text>

        {/* ACCOUNT */}
        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.sectionLabel, { color: subtext }]}>Account</Text>

          <TouchableOpacity style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Change Email</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Change Password</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row}>
            <Text style={[styles.label, { color: "#FF3B30" }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* NOTIFICATIONS */}
        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.sectionLabel, { color: subtext }]}>
            Notifications
          </Text>

          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Enable Alerts</Text>
            <Switch
              value={notifications}
              onValueChange={() => setNotifications(!notifications)}
            />
          </View>

          <TouchableOpacity style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Daily Reminder Time</Text>
            <Text style={[styles.value, { color: subtext }]}>09:00</Text>
          </TouchableOpacity>
        </View>

        {/* SECURITY */}
        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.sectionLabel, { color: subtext }]}>Security</Text>

          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>App Lock</Text>
            <Switch value={appLock} onValueChange={() => setAppLock(!appLock)} />
          </View>
        </View>

        {/* DATA */}
        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.sectionLabel, { color: subtext }]}>Data</Text>

          <TouchableOpacity style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Export Tasks</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={clearAllData}>
            <Text style={[styles.label, { color: "#FF3B30" }]}>
              Clear All Tasks
            </Text>
          </TouchableOpacity>
        </View>

        {/* ABOUT */}
        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.sectionLabel, { color: subtext }]}>About</Text>

          <TouchableOpacity style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Version</Text>
            <Text style={[styles.value, { color: subtext }]}>1.0.0</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Developer</Text>
            <Text style={[styles.value, { color: subtext }]}>You</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  title: {
    fontSize: 32,
    fontWeight: "700",
    marginHorizontal: 16,
    marginBottom: 20,
  },

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

  /* Blur header */
  blurHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 20,
  },

  /* Smooth fade under blur */
  blurFade: {
    position: "absolute",
    top: 80,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 19,
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { height: 8, width: 0 },
    shadowRadius: 12,
  },
});
