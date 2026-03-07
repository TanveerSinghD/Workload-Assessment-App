import { getTasks } from "@/lib/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { updateAvailabilityWithFeedback } from "@/utils/availabilityFeedback";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Task = {
  id: number;
  title: string;
  notes?: string | null;
  difficulty: "easy" | "medium" | "hard";
  due_date?: string | null;
  completed?: number;
};

export default function TasksByDifficultyScreen() {
  const params = useLocalSearchParams<{ level?: string }>();
  const level = (params.level as "easy" | "medium" | "hard" | undefined) ?? "easy";
  const navigation = useNavigation();

  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const [tasks, setTasks] = useState<Task[]>([]);

  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const card = dark ? "#2C2C2E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const text = dark ? "#FFFFFF" : "#000000";
  const subtle = dark ? "#9A9A9D" : "#6B6B6C";

  const load = useCallback(async () => {
    const data = await getTasks();
    setTasks(Array.isArray(data) ? (data as Task[]) : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    return tasks.filter((t) => t.difficulty === level && !t.completed);
  }, [tasks, level]);

  const handleToggleComplete = useCallback(
    async (task: Task) => {
      const updated = await updateAvailabilityWithFeedback(task.id, true);
      if (updated) await load();
    },
    [load]
  );

  const openQuickActions = useCallback(
    (task: Task) => {
      Alert.alert(
        "Quick actions",
        task.title,
        [
          {
            text: "Mark as complete",
            onPress: () => handleToggleComplete(task),
          },
          {
            text: "View / Edit",
            onPress: () => router.push({ pathname: "/edit-task", params: { id: String(task.id) } }),
          },
          { text: "Cancel", style: "cancel" },
        ],
        { userInterfaceStyle: dark ? "dark" : "light" }
      );
    },
    [dark, handleToggleComplete]
  );

  const title =
    level === "easy" ? "Easy tasks" : level === "medium" ? "Medium tasks" : "Hard tasks";

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={{ color: subtle, marginTop: 12 }}>No tasks here.</Text>
        ) : (
          filtered.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.card, { backgroundColor: card, borderColor: border }]}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: "/edit-task", params: { id: String(task.id) } })}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: text }]}>{task.title}</Text>
                <View style={styles.taskActions}>
                  <TouchableOpacity
                    style={[styles.taskActionBtn, { borderColor: border, backgroundColor: dark ? "#17304C" : "#EAF2FF" }]}
                    onPress={(event) => {
                      event.stopPropagation();
                      handleToggleComplete(task);
                    }}
                    accessibilityLabel={`Mark ${task.title} complete`}
                  >
                    <Ionicons name="checkmark" size={14} color={dark ? "#8FC0FF" : "#0A84FF"} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.taskActionBtn, { borderColor: border, backgroundColor: dark ? "#282D37" : "#F2F4F8" }]}
                    onPress={(event) => {
                      event.stopPropagation();
                      openQuickActions(task);
                    }}
                    accessibilityLabel={`More actions for ${task.title}`}
                  >
                    <Ionicons name="ellipsis-horizontal" size={14} color={subtle} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={{ color: subtle }}>
                {task.due_date ? `Due ${task.due_date}` : "No due date"}
              </Text>
              {task.notes ? (
                <Text style={{ color: text, marginTop: 6 }} numberOfLines={2}>
                  {task.notes}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 20, paddingBottom: 50, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
    flex: 1,
  },
  taskActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  taskActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
