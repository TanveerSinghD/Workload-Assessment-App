import { getTasks } from "@/app/database/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { updateAvailabilityWithFeedback } from "@/utils/availabilityFeedback";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Task = {
  id: number;
  title: string;
  notes?: string | null;
  difficulty: "easy" | "medium" | "hard";
  due_date?: string | null;
  completed?: number;
};

function dateFromTask(task: Task) {
  if (!task.due_date) return null;
  const date = new Date(`${task.due_date}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysDiff(date: Date | null, today: Date) {
  if (!date) return null;
  const diff = date.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export default function CompletedTasksScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [windowDays, setWindowDays] = useState<"all" | 7 | 30>("all");

  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const card = dark ? "#2C2C2E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const text = dark ? "#FFFFFF" : "#000000";
  const subtle = dark ? "#9A9A9D" : "#6B6B6C";

  const loadTasks = useCallback(async () => {
    const data = await getTasks();
    setTasks(Array.isArray(data) ? (data as Task[]) : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.completed) return false;
      if (difficulty !== "all" && task.difficulty !== difficulty) return false;

      const diff = daysDiff(dateFromTask(task), today);
      if (windowDays === "all" || diff === null) return true;
      return Math.abs(diff) <= windowDays;
    });
  }, [tasks, difficulty, windowDays, today]);

  const handleToggleComplete = useCallback(
    async (task: Task) => {
      const updated = await updateAvailabilityWithFeedback(task.id, false);
      if (updated) {
        await loadTasks();
      }
    },
    [loadTasks]
  );

  const openActions = useCallback(
    (task: Task) => {
      Alert.alert(
        "Completed task",
        task.title,
        [
          {
            text: "Mark as active",
            onPress: () => handleToggleComplete(task),
          },
          {
            text: "View / Edit",
            onPress: () => router.push({ pathname: "/edit-task", params: { id: String(task.id) } }),
          },
          { text: "Close", style: "cancel" },
        ],
        { userInterfaceStyle: dark ? "dark" : "light" }
      );
    },
    [dark, handleToggleComplete]
  );

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.filtersRow}>
          {(["all", "easy", "medium", "hard"] as const).map((level) => (
            <TouchableOpacity
              key={level}
              onPress={() => setDifficulty(level)}
              style={[
                styles.chip,
                {
                  borderColor: difficulty === level ? "#34C759" : border,
                  backgroundColor: difficulty === level ? "#34C75922" : "transparent",
                },
              ]}
            >
              <Text style={{ color: text, fontWeight: "700" }}>
                {level === "all"
                  ? "All"
                  : level === "easy"
                  ? "Easy"
                  : level === "medium"
                  ? "Medium"
                  : "Hard"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filtersRow}>
          {(["all", 7, 30] as const).map((win) => (
            <TouchableOpacity
              key={win}
              onPress={() => setWindowDays(win)}
              style={[
                styles.chip,
                {
                  borderColor: windowDays === win ? "#0A84FF" : border,
                  backgroundColor: windowDays === win ? "#0A84FF22" : "transparent",
                },
              ]}
            >
              <Text style={{ color: text, fontWeight: "700" }}>
                {win === "all" ? "All dates" : `Last ${win}d`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <Text style={{ color: subtle, marginTop: 12 }}>No completed tasks match this filter.</Text>
        ) : (
          filtered.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.card, { backgroundColor: card, borderColor: border }]}
              onPress={() => router.push({ pathname: "/edit-task", params: { id: String(task.id) } })}
              onLongPress={() => openActions(task)}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: text }]}>{task.title}</Text>
                <View style={[styles.pill, { borderColor: border }]}>
                  <Text style={{ color: subtle }}>
                    {task.difficulty.charAt(0).toUpperCase() + task.difficulty.slice(1)}
                  </Text>
                </View>
              </View>
              <Text style={{ color: subtle, marginTop: 4 }}>
                {task.due_date ? `Due ${task.due_date}` : "No due date"}
              </Text>
              {task.notes ? (
                <Text style={{ color: text, marginTop: 8 }} numberOfLines={2}>
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
  container: { flex: 1, padding: 20, paddingTop: 40 },
  scrollContent: { paddingBottom: 50, gap: 12 },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
});
