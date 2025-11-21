import { deleteTask, duplicateTask, getTasks } from "@/app/database/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { updateAvailabilityWithFeedback } from "@/utils/availabilityFeedback";
import { Ionicons } from "@expo/vector-icons";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";

type Task = {
  id: number;
  title: string;
  notes?: string | null;
  difficulty: "easy" | "medium" | "hard";
  due_date: string;
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
  return diff / (1000 * 60 * 60 * 24);
}

// Helper: short description
function getShortDescription(notes?: string | null) {
  if (!notes) return "";
  const words = notes.trim().split(/\s+/);
  return words.slice(0, 3).join(" ") + "...";
}

export default function TasksScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const card = dark ? "#2C2C2E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(150,150,150,0.25)";
  const text = dark ? "#FFFFFF" : "#000000";
  const subtle = dark ? "#9A9A9D" : "#6B6B6C";
  const highlight = dark ? "#3A3A3C" : "#F2F2F7"; // You chose D (same colour)

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"all" | "today" | "week" | "overdue">("all");
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setRefreshing(true);
      const dbTasks = await getTasks();
      setTasks(Array.isArray(dbTasks) ? (dbTasks as Task[]) : []);
    } catch (error) {
      console.error("Failed to load tasks", error);
      setTasks([]);
    } finally {
      setRefreshing(false);
    }
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

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (task.completed) return false;

      const diff = daysDiff(dateFromTask(task), today);
      if (filter === "all") return true;
      if (diff === null) return false;

      if (filter === "today") return diff === 0;
      if (filter === "week") return diff >= 0 && diff <= 7;
      if (filter === "overdue") return diff < 0;

      return true;
    });
  }, [filter, tasks, today]);

  const grouped = {
    easy: filteredTasks.filter((t) => t.difficulty === "easy"),
    medium: filteredTasks.filter((t) => t.difficulty === "medium"),
    hard: filteredTasks.filter((t) => t.difficulty === "hard"),
  };
  const openDifficultyView = (level: "easy" | "medium" | "hard") => {
    router.push({ pathname: "/tasks-difficulty", params: { level } });
  };

  const handleMarkDone = async (task: Task) => {
    const nextState = task.completed ? false : true;
    const updated = await updateAvailabilityWithFeedback(task.id, nextState);
    if (updated) {
      await loadTasks();
    }
  };

  const handleDuplicate = async (task: Task) => {
    await duplicateTask(task.id);
    await loadTasks();
  };

  const handleDelete = (task: Task) => {
    Alert.alert(
      "Delete task?",
      `This will remove "${task.title}".`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTask(task.id);
            await loadTasks();
          },
        },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  };

  const openQuickActions = (task: Task) => {
    Alert.alert(
      "Quick actions",
      task.title,
      [
        {
          text: task.completed ? "Mark as not done" : "Mark done",
          onPress: () => handleMarkDone(task),
        },
        { text: "Duplicate", onPress: () => handleDuplicate(task) },
        { text: "Delete", style: "destructive", onPress: () => handleDelete(task) },
        { text: "Cancel", style: "cancel" },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  };

  const renderTasks = (tasks: Task[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalList}
    >
      {tasks.map((task) => {
        const completed = !!task.completed;

        return (
          <View
            key={task.id}
            style={[
              styles.taskContainer,
              { backgroundColor: highlight, borderColor: border }
            ]}
          >
            <Link
              href={{ pathname: "/edit-task", params: { id: task.id } }}
              asChild
            >
              <TouchableOpacity
                delayLongPress={350}
                onLongPress={() => openQuickActions(task)}
                style={[
                  styles.taskCard,
                  { backgroundColor: card, borderColor: border, opacity: completed ? 0.65 : 1 }
                ]}
              >
                {/* TITLE */}
                <Text
                  style={[
                    styles.taskTitle,
                    {
                      color: text,
                      textDecorationLine: completed ? "line-through" : "none"
                    },
                  ]}
                >
                  {task.title}
                </Text>

                {/* DUE DATE */}
                <Text
                  style={[
                    styles.taskSub,
                    {
                      color: subtle,
                      marginTop: 8,
                      paddingBottom: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: border,
                      marginBottom: 8,
                      fontSize: 16
                    },
                  ]}
                >
                  Due {task.due_date}
                </Text>

                {/* NOTES */}
                {task.notes ? (
                  <Text style={[styles.taskSubNotes, { color: subtle }]}>
                    • {getShortDescription(task.notes)}
                  </Text>
                ) : null}

                {/* STATUS */}
                {completed ? (
                  <View style={styles.statusPill}>
                    <Ionicons name="checkmark-done" size={14} color="#2ECC71" />
                    <Text style={styles.statusText}>Done</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </Link>
          </View>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadTasks}
            tintColor={dark ? "#FFF" : "#000"}
          />
        }
      >
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
        <TouchableOpacity
          style={[styles.completedButton, { borderColor: border }]}
          activeOpacity={0.85}
          onPress={() => router.push("/completed-tasks")}
        >
          <Text style={[styles.completedButtonText, { color: text }]}>View completed tasks</Text>
          <Ionicons name="chevron-forward" size={18} color={subtle} />
        </TouchableOpacity>

        {/* EASY */}
        <View style={[styles.sectionBox, { borderColor: border, backgroundColor: card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              🟢 Easy ({grouped.easy.length})
            </Text>
            <TouchableOpacity onPress={() => openDifficultyView("easy")} activeOpacity={0.8}>
              <Ionicons name="chevron-forward" size={22} color={subtle} />
            </TouchableOpacity>
          </View>
          {grouped.easy.length === 0 ? (
            <Text style={[styles.empty, { color: subtle }]}>No easy tasks.</Text>
          ) : renderTasks(grouped.easy)}
        </View>

        {/* MEDIUM */}
        <View style={[styles.sectionBox, { borderColor: border, backgroundColor: card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              🟡 Medium ({grouped.medium.length})
            </Text>
            <TouchableOpacity onPress={() => openDifficultyView("medium")} activeOpacity={0.8}>
              <Ionicons name="chevron-forward" size={22} color={subtle} />
            </TouchableOpacity>
          </View>
          {grouped.medium.length === 0 ? (
            <Text style={[styles.empty, { color: subtle }]}>No medium tasks.</Text>
          ) : renderTasks(grouped.medium)}
        </View>

        {/* HARD */}
        <View style={[styles.sectionBox, { borderColor: border, backgroundColor: card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              🔴 Hard ({grouped.hard.length})
            </Text>
            <TouchableOpacity onPress={() => openDifficultyView("hard")} activeOpacity={0.8}>
              <Ionicons name="chevron-forward" size={22} color={subtle} />
            </TouchableOpacity>
          </View>
          {grouped.hard.length === 0 ? (
            <Text style={[styles.empty, { color: subtle }]}>No hard tasks.</Text>
          ) : renderTasks(grouped.hard)}
        </View>

      </ScrollView>

      {/* Floating Add Button */}
      <Link href="/add-assignment" asChild>
        <TouchableOpacity style={styles.fab}>
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80 },

  filtersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  filterChip: {
    flex: 1,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
  },
  completedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  completedButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },

  sectionBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  empty: { fontSize: 16, marginTop: 8 },

  /* Bigger grey box */
  taskContainer: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginRight: 20,
    minWidth: 150,
  },

  horizontalList: {
    flexDirection: "row",
    paddingHorizontal: 4,
  },

  /* Bigger white card */
  taskCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    width: 200,
    gap: 6,
  },

  /* Bigger title text */
  taskTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },

  /* Due date */
  taskSub: {
    fontSize: 16,
    marginTop: 4,
  },

  /* Notes */
  taskSubNotes: {
    fontSize: 16,
    marginTop: 4,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(46, 204, 113, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    gap: 6,
  },

  statusText: {
    color: "#2ECC71",
    fontWeight: "700",
    fontSize: 13,
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 110,
    backgroundColor: "#007AFF",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
