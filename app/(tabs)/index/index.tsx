import { getTasks } from "@/app/database/database";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PieChart } from "react-native-gifted-charts";

type Task = {
  id: number;
  title: string;
  notes?: string | null;
  difficulty: "easy" | "medium" | "hard";
  due_date?: string | null;
  completed?: number;
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Theme colours
  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const card = dark ? "#2C2C2E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(150,150,150,0.2)";
  const text = dark ? "#FFFFFF" : "#000000";
  const subtle = dark ? "#9A9A9D" : "#6B6B6C";

  // Filters
  const [filter, setFilter] = useState<"all" | "today" | "week" | "overdue">("all");

  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const dbTasks = await getTasks();
      setTasks(Array.isArray(dbTasks) ? (dbTasks as Task[]) : []);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load tasks", err);
      setError("Couldn't load tasks. Pull to refresh or restart.");
      setTasks([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const dateFromTask = useCallback((task: Task) => {
    if (!task.due_date) return null;
    return new Date(`${task.due_date}T00:00:00`);
  }, []);

  const daysDiff = useCallback((date: Date | null) => {
    if (!date) return null;
    const diff = date.getTime() - today.getTime();
    return diff / (1000 * 60 * 60 * 24);
  }, [today]);

  // Auto-computed tracking stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => !!t.completed).length;
    const openTasks = total - completed;

    let overdue = 0;
    let dueToday = 0;
    let dueThisWeek = 0;

    tasks.forEach((task) => {
      if (task.completed) return;
      const diff = daysDiff(dateFromTask(task));
      if (diff === null) return;
      if (diff < 0) overdue += 1;
      if (diff === 0) dueToday += 1;
      if (diff >= 0 && diff <= 7) dueThisWeek += 1;
    });

    return {
      total,
      completed,
      openTasks,
      overdue,
      dueToday,
      dueThisWeek,
    };
  }, [tasks, daysDiff, dateFromTask]);

  // Apply filter to tasks
  const filteredAssignments = useMemo(() => {
    if (filter === "all") return tasks;

    return tasks.filter((task) => {
      const diff = daysDiff(dateFromTask(task));
      if (diff === null) return false;

      if (filter === "today") return diff === 0;
      if (filter === "week") return diff >= 0 && diff <= 7;
      if (filter === "overdue") return !task.completed && diff < 0;

      return true;
    });
  }, [filter, tasks, daysDiff, dateFromTask]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* TODAY’S OVERVIEW */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: card,
              borderColor: border,
              marginTop: 20, // ⭐ MOVE IT DOWN FURTHER
            },
          ]}
        >
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
            Today’s Overview
          </ThemedText>

          {error ? (
            <ThemedText style={{ color: "#FF3B30" }}>{error}</ThemedText>
          ) : tasks.length === 0 ? (
            <ThemedText style={{ color: subtle }}>
              No tasks added yet.
            </ThemedText>
          ) : (
            <View style={{ gap: 6 }}>
              <ThemedText style={{ color: text }}>Tasks due today: {stats.dueToday}</ThemedText>
              <ThemedText style={{ color: text }}>Due this week: {stats.dueThisWeek}</ThemedText>
              <ThemedText style={{ color: text }}>Overdue: {stats.overdue}</ThemedText>
            </View>
          )}
        </View>

        {/* HEALTH PANEL */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
            Health
          </ThemedText>

          {/* Health Rows */}
          <View style={{ marginBottom: 16, gap: 12 }}>
            <View style={styles.healthRow}>
              <Text style={[styles.healthLabel, { color: subtle }]}>Tasks</Text>
              <Text style={[styles.healthValue, { color: text }]}>
                {stats.total} total tasks
              </Text>
            </View>

            <View style={styles.healthRow}>
              <Text style={[styles.healthLabel, { color: subtle }]}>Progress</Text>
              <Text style={[styles.healthValue, { color: text }]}>
                {stats.total === 0
                  ? "0% complete"
                  : `${Math.round((stats.completed / stats.total) * 100)}% complete`}
              </Text>
            </View>
          </View>

          {/* Pie Chart */}
          <View style={styles.pieContainer}>
            <PieChart
              donut
              radius={75}
              innerRadius={48}
              textColor={text}
              data={[
                {
                  value: stats.openTasks,
                  color: "#D1D1D6",
                },
                {
                  value: stats.completed,
                  color: "#4CD964",
                },
                {
                  value: 0,
                  color: "#32ADE6",
                },
              ]}
            />
          </View>

          {/* Chart Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#D1D1D6" }]} />
              <Text style={[styles.legendText, { color: text }]}>Open</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#4CD964" }]} />
              <Text style={[styles.legendText, { color: text }]}>Complete</Text>
            </View>
          </View>
        </View>

        {/* FILTER BUTTONS */}
        <View style={styles.filtersRow}>
          {(["all", "today", "week", "overdue"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                {
                  borderColor: filter === f ? "#007AFF" : border,
                  backgroundColor: filter === f ? "#007AFF22" : "transparent",
                },
              ]}
            >
              <Text style={{ color: text, fontWeight: "600" }}>
                {f === "all"
                  ? "All"
                  : f === "today"
                  ? "Today"
                  : f === "week"
                  ? "This Week"
                  : "Overdue"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* TASK LIST */}
        <View style={{ marginTop: 20 }}>
          {error ? (
            <ThemedText style={{ color: "#FF3B30", textAlign: "center" }}>
              {error}
            </ThemedText>
          ) : filteredAssignments.length === 0 ? (
            <ThemedText style={{ color: subtle, textAlign: "center" }}>
              No tasks in this category.
            </ThemedText>
          ) : (
            filteredAssignments.map((a) => (
              <View
                key={a.id}
                style={[
                  styles.assignmentCard,
                  { backgroundColor: card, borderColor: border },
                ]}
              >
                <ThemedText
                  style={{ color: text, fontSize: 17, fontWeight: "600" }}
                >
                  {a.title}
                </ThemedText>
                <ThemedText style={{ color: subtle }}>
                  {a.due_date
                    ? `Due ${new Date(`${a.due_date}T00:00:00`).toDateString()}`
                    : "No due date"}
                </ThemedText>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60, // ⭐ THIS IS YOUR TOP PADDING LINE (around line ~183)
  },

  card: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 18,
  },

  cardTitle: {
    marginBottom: 8,
    fontWeight: "700",
  },

  healthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  healthLabel: {
    fontSize: 15,
  },
  healthValue: {
    fontSize: 15,
    fontWeight: "600",
  },

  pieContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 12,
  },

  legendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
  },

  filtersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  filterChip: {
    flex: 1,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
  },

  assignmentCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
});
