import { getTasks } from "@/app/database/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Filter = "open" | "overdue" | "today" | "week" | "next3" | "next7" | "recent";

type Task = {
  id: number;
  title: string;
  notes?: string | null;
  difficulty: "easy" | "medium" | "hard";
  due_date?: string | null;
  completed?: number;
  created_at?: string | null;
};

function dateFromTask(task: Task) {
  if (!task.due_date) return null;
  const d = new Date(`${task.due_date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function createdDate(task: Task) {
  if (!task.created_at) return null;
  const d = new Date(task.created_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function TasksFilterScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const filter = (params.filter as Filter | undefined) ?? "today";

  const navigation = useNavigation();
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const [tasks, setTasks] = useState<Task[]>([]);

  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const card = dark ? "#2C2C2E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const text = dark ? "#FFFFFF" : "#000000";
  const subtle = dark ? "#9A9A9D" : "#6B6B6C";

  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);

  const daysDiff = useCallback(
    (date: Date | null) => {
      if (!date) return null;
      const diff = date.getTime() - today.getTime();
      return diff / (1000 * 60 * 60 * 24);
    },
    [today]
  );

  const loadTasks = useCallback(async () => {
    const data = await getTasks();
    setTasks(Array.isArray(data) ? (data as Task[]) : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const title = useMemo(() => {
    switch (filter) {
      case "open":
        return "All open tasks";
      case "overdue":
        return "Overdue tasks";
      case "today":
        return "Due today";
      case "week":
        return "Due this week";
      case "next3":
        return "Next 3 days";
      case "next7":
        return "Next 7 days";
      case "recent":
        return "Added last 48h";
      default:
        return "Tasks";
    }
  }, [filter]);

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (task.completed) return false;

      const dueDiff = daysDiff(dateFromTask(task));

      if (filter === "open") return true;
      if (filter === "overdue") return dueDiff !== null && dueDiff < 0;
      if (filter === "today") return dueDiff === 0;
      if (filter === "week") return dueDiff !== null && dueDiff >= 0 && dueDiff <= 7;
      if (filter === "next3") return dueDiff !== null && dueDiff >= 0 && dueDiff <= 2;
      if (filter === "next7") return dueDiff !== null && dueDiff >= 0 && dueDiff <= 6;
      if (filter === "recent") {
        const created = createdDate(task);
        if (!created) return false;
        const diff = (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 2;
      }

      return true;
    });
  }, [tasks, filter, daysDiff, today]);

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={{ color: subtle, marginTop: 12 }}>No tasks match this filter.</Text>
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
                <View style={[styles.pill, { borderColor: border }]}>
                  <Text style={{ color: subtle }}>
                    {task.difficulty.charAt(0).toUpperCase() + task.difficulty.slice(1)}
                  </Text>
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
  scrollContent: { padding: 20, paddingTop: 20, paddingBottom: 120, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 10,
  },
  cardTitle: {
    fontSize: 17,
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
