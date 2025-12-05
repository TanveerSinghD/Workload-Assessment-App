import { getTasks } from "@/lib/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { updateAvailabilityWithFeedback } from "@/utils/availabilityFeedback";
import { BlurView } from "expo-blur";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { useScrollToTop } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Task = {
  id: number;
  title: string;
  notes: string | null;
  difficulty: "easy" | "medium" | "hard";
  due_date: string;
  completed?: number;
};

export default function CalendarScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const [assignments, setAssignments] = useState<Task[]>([]);
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayStr = useMemo(() => today.toISOString().split("T")[0], [today]);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const headerHeight = insets.top + 20;

  // LIVE REFRESH WHEN SCREEN FOCUSES
  const loadTasks = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setRefreshing(true);
      const data = (await getTasks()) as Task[];
      setAssignments(data);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks(false);
    }, [loadTasks])
  );

  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  // Difficulty colours
  const difficultyDot = useMemo(
    () => ({
      easy: "#34C759",
      medium: "#FFD60A",
      hard: "#FF453A",
    }),
    []
  );

  const filteredAssignments = useMemo(() => {
    return assignments.filter((t) => {
      if (!showCompleted && t.completed) return false;
      if (difficulty !== "all" && t.difficulty !== difficulty) return false;
      return true;
    });
  }, [assignments, difficulty, showCompleted]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    filteredAssignments.forEach((task) => {
      const d = task.due_date;
      if (!d) return;

      const dots = marks[d]?.dots ? [...marks[d].dots] : [];
      const dotColor = difficultyDot[task.difficulty];
      if (!dots.find((dot: any) => dot.key === task.difficulty)) {
        dots.push({ key: task.difficulty, color: dotColor });
      }

      marks[d] = {
        ...marks[d],
        dots,
      };
    });

    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] || {}),
        selected: true,
        selectedColor: "#0A84FF55",
      };
    }

    marks[todayStr] = {
      ...(marks[todayStr] || {}),
      selected: true,
      selectedColor: "#34C759",
      selectedTextColor: "#FFFFFF",
    };

    return marks;
  }, [filteredAssignments, difficultyDot, selectedDate, todayStr]);

  const assignmentsForDay = useMemo(() => {
    if (selectedDate) {
      return filteredAssignments.filter((a) => a.due_date === selectedDate);
    }
    // agenda-style view: next 7 days (including today)
    const next7 = new Date(today);
    next7.setDate(next7.getDate() + 7);
    const next7Str = next7.toISOString().split("T")[0];

    return filteredAssignments
      .filter((a) => a.due_date && a.due_date >= todayStr && a.due_date <= next7Str)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [filteredAssignments, selectedDate, today, todayStr]);

  const currentMonthStr = `${year}-${String(month).padStart(2, "0")}-01`;

  // RESET
  function resetSelected() {
    setSelectedDate(null);
  }

  // Month arrows
  function goPrevMonth() {
    resetSelected();

    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }

  function goNextMonth() {
    resetSelected();

    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  const handleToggleComplete = useCallback(
    async (task: Task) => {
      const nextState = !task.completed;
      const updated = await updateAvailabilityWithFeedback(task.id, nextState);
      if (updated) {
        await loadTasks();
      }
    },
    [loadTasks]
  );

  const handleQuickActions = useCallback(
    (task: Task) => {
      Alert.alert(
        "Quick actions",
        task.title,
        [
          {
            text: task.completed ? "Mark as incomplete" : "Mark as complete",
            onPress: () => handleToggleComplete(task),
          },
          {
            text: "View / Edit",
            onPress: () => router.push({ pathname: "/edit-task", params: { id: String(task.id) } }),
          },
          { text: "Cancel", style: "cancel" },
        ],
        { userInterfaceStyle: isDark ? "dark" : "light" }
      );
    },
    [handleToggleComplete, isDark]
  );

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }}>
    <View style={[styles.container, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
      <BlurView
        intensity={40}
        tint={isDark ? "dark" : "light"}
        style={[styles.blurHeader, { height: headerHeight }]}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTasks(true)}
            tintColor={isDark ? "#FFF" : "#000"}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goPrevMonth}>
            <Text style={[styles.arrow, { color: isDark ? "#FFF" : "#007AFF" }]}>
              {"<"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              resetSelected();
              setShowYearPicker(true);
            }}
          >
            <Text
              style={[
                styles.headerText,
                { color: isDark ? "#FFF" : "#007AFF" },
              ]}
            >
              {year}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              resetSelected();
              setShowMonthPicker(true);
            }}
          >
            <Text
              style={[
                styles.headerText,
                { color: isDark ? "#FFF" : "#007AFF" },
              ]}
            >
              {months[month - 1]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goNextMonth}>
            <Text style={[styles.arrow, { color: isDark ? "#FFF" : "#007AFF" }]}>
              {">"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* FILTERS */}
        <View style={styles.filterRow}>
          {(["all", "easy", "medium", "hard"] as const).map((level) => (
            <TouchableOpacity
              key={level}
              onPress={() => setDifficulty(level)}
              style={[
                styles.filterChip,
                {
                  borderColor: difficulty === level ? "#0A84FF" : "#ccc",
                  backgroundColor: difficulty === level ? "#0A84FF22" : "transparent",
                },
              ]}
            >
              <Text style={{ color: isDark ? "#FFF" : "#000", fontWeight: "700" }}>
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
          <TouchableOpacity
            onPress={() => setShowCompleted((p) => !p)}
            style={[
              styles.filterChip,
              {
                borderColor: showCompleted ? "#34C759" : "#ccc",
                backgroundColor: showCompleted ? "#34C75922" : "transparent",
              },
            ]}
          >
            <Text style={{ color: isDark ? "#FFF" : "#000", fontWeight: "700" }}>
              {showCompleted ? "Showing done" : "Open only"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* CALENDAR */}
        <Calendar
          key={currentMonthStr}
          current={currentMonthStr}
          onDayPress={(day) => setSelectedDate(day.dateString)}

          onMonthChange={(date) => {
            setYear(date.year);
            setMonth(date.month);
            resetSelected();
          }}

          markingType="multi-dot"
          markedDates={markedDates}
          hideExtraDays={true}
          hideArrows
          enableSwipeMonths
          renderHeader={() => null}
          theme={{
            calendarBackground: isDark ? "#1C1C1E" : "#FFFFFF",
            dayTextColor: isDark ? "#FFFFFF" : "#000000",
            textDisabledColor: isDark ? "#666666" : "#CCCCCC",
            textSectionTitleColor: isDark ? "#B0B0B0" : "#999999",
            textDayFontSize: 16,
          }}
        />

        {/* TASK LIST / AGENDA */}
        <View style={styles.taskListContainer}>
          <Text style={[styles.agendaTitle, { color: isDark ? "#FFF" : "#111" }]}>
            {selectedDate ? `Tasks for ${selectedDate}` : "Next 7 days"}
          </Text>
          {assignmentsForDay.length === 0 ? (
            <Text style={[styles.noTasksText, { color: isDark ? "#BBB" : "#666" }]}>
              {selectedDate ? "No assignments due." : "No upcoming tasks in the next 7 days."}
            </Text>
          ) : (
            assignmentsForDay.map((item) => (
              <Link
                key={item.id}
                href={{ pathname: "/edit-task", params: { id: item.id } }}
                asChild
              >
                <TouchableOpacity
                  style={styles.taskCard}
                  onLongPress={() => handleQuickActions(item)}
                  activeOpacity={0.85}
                >
                  <View style={styles.taskHeaderRow}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: difficultyDot[item.difficulty] },
                      ]}
                    />
                    <Text style={styles.taskTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.taskDue}>Due {item.due_date}</Text>
                </TouchableOpacity>
              </Link>
            ))
          )}
        </View>
      </ScrollView>

      {/* PICKERS */}
      {/* YEAR PICKER */}
      <Modal visible={showYearPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowYearPicker(false)}
        >
          <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
            <Text style={styles.modalTitle}>Select Year</Text>

            {[2025, 2026, 2027].map((y) => (
              <TouchableOpacity
                key={y}
                style={styles.modalItem}
                onPress={() => {
                  resetSelected();
                  setYear(y);
                  setShowYearPicker(false);
                }}
              >
                <Text style={{ fontSize: 18 }}>{y}</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MONTH PICKER */}
      <Modal visible={showMonthPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowMonthPicker(false)}
        >
          <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
            <Text style={styles.modalTitle}>Select Month</Text>
            {months.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={styles.modalItem}
                onPress={() => {
                  resetSelected();
                  setMonth(i + 1);
                  setShowMonthPicker(false);
                }}
              >
                <Text style={{ fontSize: 18 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
    </SafeAreaView>
  );
}

/* --------------------- STYLES ----------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  filterChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },

  arrow: {
    fontSize: 28,
    fontWeight: "600",
    paddingHorizontal: 6,
  },

  headerText: {
    fontSize: 22,
    fontWeight: "700",
  },

  taskListContainer: {
    padding: 16,
  },

  noTasksText: {
    fontSize: 16,
  },

  agendaTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  taskCard: {
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },

  taskHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },

  taskTitle: {
    fontSize: 18,
    fontWeight: "600",
  },

  taskDue: {
    fontSize: 15,
    color: "#666",
    marginTop: 2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    width: "80%",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },

  modalItem: {
    paddingVertical: 10,
  },
  blurHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 20,
  },
});
