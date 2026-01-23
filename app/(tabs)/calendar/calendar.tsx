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
  subject: string | null;
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
  const [course, setCourse] = useState<string>("all");
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
  const headerHeight = insets.top + 8;

  const formatDateLabel = useCallback(
    (dateStr: string) => {
      const date = new Date(dateStr + "T00:00:00");
      if (dateStr === todayStr) return "Today";
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      if (dateStr === tomorrowStr) return "Tomorrow";

      return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    },
    [today, todayStr]
  );

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

  const courses = useMemo(() => {
    const unique = new Set<string>();
    assignments.forEach((t) => {
      const subject = (t.subject || "").trim();
      if (subject) unique.add(subject);
    });
    return ["all", ...Array.from(unique).sort()];
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((t) => {
      if (!showCompleted && t.completed) return false;
      if (difficulty !== "all" && t.difficulty !== difficulty) return false;
      if (course !== "all") {
        const subject = (t.subject || "").trim() || "Unassigned";
        if (subject !== course) return false;
      }
      return true;
    });
  }, [assignments, course, difficulty, showCompleted]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    filteredAssignments.forEach((task) => {
      const d = task.due_date;
      if (!d) return;

      const dots = marks[d]?.dots ? [...marks[d].dots] : [];
      const diffKey = task.difficulty || "medium";
      const dotColor = difficultyDot[diffKey];
      if (!dots.find((dot: any) => dot.key === diffKey)) {
        dots.push({ key: diffKey, color: dotColor });
      }

      marks[d] = {
        ...marks[d],
        dots,
        marked: true,
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

  const agendaDays = useMemo(() => {
    const dates: string[] = [];
    if (selectedDate) {
      dates.push(selectedDate);
    } else {
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
      }
    }

    return dates.map((dateStr) => {
      const items = filteredAssignments
        .filter((a) => a.due_date === dateStr)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
      return { date: dateStr, label: formatDateLabel(dateStr), items };
    });
  }, [filteredAssignments, formatDateLabel, selectedDate, today]);

  const hasAgendaItems = useMemo(
    () => agendaDays.some((d) => d.items.length > 0),
    [agendaDays]
  );

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
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }}>
    <View style={[styles.container, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
      <BlurView
        intensity={40}
        tint={isDark ? "dark" : "light"}
        style={[styles.blurHeader, { height: headerHeight }]}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight, paddingBottom: insets.bottom + 120 },
        ]}
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
        <View
          style={[
            styles.headerRow,
            {
              backgroundColor: isDark ? "#1F1F23" : "#F7F8FA",
              borderColor: isDark ? "#2C2C2E" : "#E5E5EA",
            },
          ]}
        >
          <TouchableOpacity onPress={goPrevMonth} style={styles.arrowButton}>
            <Text style={[styles.arrow, { color: isDark ? "#FFFFFF" : "#007AFF" }]}>
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
                { color: isDark ? "#FFFFFF" : "#0A84FF" },
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
                { color: isDark ? "#FFFFFF" : "#0A84FF" },
              ]}
            >
              {months[month - 1]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goNextMonth} style={styles.arrowButton}>
            <Text style={[styles.arrow, { color: isDark ? "#FFFFFF" : "#007AFF" }]}>
              {">"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* QUICK JUMPS */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            onPress={() => {
              setYear(today.getFullYear());
              setMonth(today.getMonth() + 1);
              setSelectedDate(todayStr);
            }}
            style={[styles.quickChip, { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }]}
          >
            <Text style={[styles.quickText, { color: isDark ? "#FFF" : "#111" }]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setYear(today.getFullYear());
              setMonth(today.getMonth() + 1);
              resetSelected();
            }}
            style={[styles.quickChip, { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }]}
          >
            <Text style={[styles.quickText, { color: isDark ? "#FFF" : "#111" }]}>This week</Text>
          </TouchableOpacity>
        </View>

        {/* FILTERS */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: isDark ? "#D0D0D0" : "#444" }]}>Priority</Text>
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
                    ? "Low"
                    : level === "medium"
                    ? "Medium"
                    : "High"}
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

          {courses.length > 1 && (
            <>
              <Text style={[styles.filterLabel, { color: isDark ? "#D0D0D0" : "#444" }]}>
                Course
              </Text>
              <View style={styles.filterRow}>
                {courses.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCourse(c)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: course === c ? "#FF9F0A" : "#ccc",
                        backgroundColor: course === c ? "#FF9F0A22" : "transparent",
                      },
                    ]}
                  >
                    <Text style={{ color: isDark ? "#FFF" : "#000", fontWeight: "700" }}>
                      {c === "all" ? "All courses" : c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
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
          <View style={styles.agendaHeaderRow}>
            <Text style={[styles.agendaTitle, { color: isDark ? "#FFF" : "#111" }]}>
              {selectedDate ? `Tasks for ${formatDateLabel(selectedDate)}` : "This week"}
            </Text>
            {selectedDate && (
              <TouchableOpacity onPress={resetSelected}>
                <Text style={{ color: "#0A84FF", fontWeight: "700" }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {!hasAgendaItems ? (
            <Text style={[styles.noTasksText, { color: isDark ? "#BBB" : "#666" }]}>
              {selectedDate ? "No assignments due." : "No upcoming tasks in the next 7 days."}
            </Text>
          ) : (
            agendaDays.map((day) => (
              <View key={day.date} style={[styles.agendaDayBlock, { borderColor: isDark ? "#2C2C2E" : "#E5E5EA" }]}>
                <View style={styles.agendaDayHeader}>
                  <Text style={[styles.agendaDayLabel, { color: isDark ? "#FFF" : "#111" }]}>
                    {day.label}
                  </Text>
                  <Text style={[styles.agendaMeta, { color: isDark ? "#AAA" : "#555" }]}>
                    {day.items.length} {day.items.length === 1 ? "task" : "tasks"}
                  </Text>
                </View>

                {day.items.length === 0 ? (
                  <Text style={[styles.noTasksText, { color: isDark ? "#777" : "#888" }]}>
                    No tasks for this day.
                  </Text>
                ) : (
                  day.items.map((item) => (
                    <Link
                      key={item.id}
                      href={{ pathname: "/edit-task", params: { id: item.id } }}
                      asChild
                    >
                      <TouchableOpacity
                        style={[styles.taskCard, { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" }]}
                        onLongPress={() => handleQuickActions(item)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.taskHeaderRow}>
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: difficultyDot[item.difficulty || "medium"] },
                            ]}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.taskTitle, { color: isDark ? "#FFF" : "#111" }]}>
                              {item.title}
                            </Text>
                            {!!item.subject && (
                              <Text style={[styles.taskMeta, { color: isDark ? "#AAA" : "#555" }]}>
                                {item.subject}
                              </Text>
                            )}
                          </View>
                        </View>
                        <Text style={[styles.taskDue, { color: isDark ? "#BBB" : "#666" }]}>
                          Due {item.due_date}
                        </Text>
                      </TouchableOpacity>
                    </Link>
                  ))
                )}
              </View>
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
    paddingHorizontal: 16,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    alignSelf: "center",
    width: "90%",
    maxWidth: 360,
  },
  arrowButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  quickText: {
    fontWeight: "700",
    fontSize: 15,
  },
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 6,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
    fontSize: 20,
    fontWeight: "800",
  },

  taskListContainer: {
    padding: 16,
  },

  agendaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  noTasksText: {
    fontSize: 16,
  },

  agendaTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  agendaDayBlock: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  agendaDayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  agendaDayLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  agendaMeta: {
    fontSize: 13,
    fontWeight: "600",
  },
  taskCard: {
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
  taskMeta: {
    fontSize: 13,
    marginTop: 2,
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
