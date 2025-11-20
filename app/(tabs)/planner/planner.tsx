import { useColorScheme } from "@/hooks/use-color-scheme";
import { StyleSheet, Text, View } from "react-native";

export default function PlannerScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  // ⭐ Same global colours as the rest of the app
  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const text = dark ? "#FFFFFF" : "#000000";

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <Text style={[styles.title, { color: text }]}>Planner</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
});
