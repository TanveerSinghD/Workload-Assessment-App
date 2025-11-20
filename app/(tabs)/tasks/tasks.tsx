import { deleteTask, duplicateTask, getTasks, setTaskCompleted } from "@/app/database/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Task = {
  id: number;
  title: string;
  notes?: string | null;
  difficulty: "easy" | "medium" | "hard";
  due_date: string;
  completed?: number;
};

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

  const loadTasks = useCallback(async () => {
    try {
      const dbTasks = await getTasks();
      setTasks(Array.isArray(dbTasks) ? (dbTasks as Task[]) : []);
    } catch (error) {
      console.error("Failed to load tasks", error);
      setTasks([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const grouped = {
    easy: tasks.filter((t) => t.difficulty === "easy"),
    medium: tasks.filter((t) => t.difficulty === "medium"),
    hard: tasks.filter((t) => t.difficulty === "hard"),
  };

  const handleMarkDone = async (task: Task) => {
    await setTaskCompleted(task.id, task.completed ? false : true);
    await loadTasks();
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
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* EASY */}
        <View style={[styles.sectionBox, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>
            🟢 Easy ({grouped.easy.length})
          </Text>
          {grouped.easy.length === 0 ? (
            <Text style={[styles.empty, { color: subtle }]}>No easy tasks.</Text>
          ) : renderTasks(grouped.easy)}
        </View>

        {/* MEDIUM */}
        <View style={[styles.sectionBox, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>
            🟡 Medium ({grouped.medium.length})
          </Text>
          {grouped.medium.length === 0 ? (
            <Text style={[styles.empty, { color: subtle }]}>No medium tasks.</Text>
          ) : renderTasks(grouped.medium)}
        </View>

        {/* HARD */}
        <View style={[styles.sectionBox, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>
            🔴 Hard ({grouped.hard.length})
          </Text>
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

  empty: { fontSize: 16, marginTop: 8 },

  /* Bigger grey box */
  taskContainer: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginRight: 20,
    minWidth: 180,
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
    width: 300,
    justifyContent: "center",
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
