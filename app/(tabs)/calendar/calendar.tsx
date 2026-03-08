import { getTasks } from "@/lib/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { updateAvailabilityWithFeedback } from "@/utils/availabilityFeedback";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Animated, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  const colors = useThemeColors();
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
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set([new Date().toISOString().split("T")[0]]));
  const accordionAnims = useRef<Record<string, Animated.Value>>({});
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

  function resetSelected() {
    setSelectedDate(null);
  }

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
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
            tintColor={isDark ? colors.textPrimary : "#000"}
          />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goPrevMonth} style={styles.arrowButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color={colors.accentBlue} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { resetSelected(); setShowMonthPicker(true); }}
            onLongPress={() => { resetSelected(); setShowYearPicker(true); }}
            style={styles.headerTitleBtn}
          >
            <Text style={[styles.headerText, { color: colors.textPrimary }]}>
              {months[month - 1]}
            </Text>
            <Text style={[styles.headerYear, { color: colors.textMuted }]}>
              {year}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={goNextMonth} style={styles.arrowButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-forward" size={22} color={colors.accentBlue} />
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity
            onPress={() => {
              setYear(today.getFullYear());
              setMonth(today.getMonth() + 1);
              setSelectedDate(todayStr);
            }}
            style={[styles.quickChip, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.quickText, { color: colors.textPrimary }]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setYear(today.getFullYear());
              setMonth(today.getMonth() + 1);
              resetSelected();
            }}
            style={[styles.quickChip, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.quickText, { color: colors.textPrimary }]}>This week</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Priority</Text>
          <View style={styles.filterRow}>
            {(["all", "easy", "medium", "hard"] as const).map((level) => (
              <TouchableOpacity
                key={level}
                onPress={() => setDifficulty(level)}
                style={[
                  styles.filterChip,
                  {
                    borderColor: difficulty === level ? colors.accentBlue : colors.borderSubtle,
                    backgroundColor: difficulty === level ? `${colors.accentBlue}22` : "transparent",
                  },
                ]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
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
                  borderColor: showCompleted ? colors.successGreen : colors.borderSubtle,
                  backgroundColor: showCompleted ? `${colors.successGreen}22` : "transparent",
                },
              ]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                {showCompleted ? "Showing done" : "Open only"}
              </Text>
            </TouchableOpacity>
          </View>

          {courses.length > 1 && (
            <>
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
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
                        borderColor: course === c ? colors.accentBlue : colors.borderSubtle,
                        backgroundColor: course === c ? `${colors.accentBlue}22` : "transparent",
                      },
                    ]}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                      {c === "all" ? "All courses" : c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

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
            calendarBackground: colors.background,
            dayTextColor: colors.textPrimary,
            textDisabledColor: colors.textMuted,
            textSectionTitleColor: colors.textSecondary,
            textDayFontSize: 16,
          }}
        />

        <View style={styles.taskListContainer}>
          <View style={styles.agendaHeaderRow}>
            <Text style={[styles.agendaTitle, { color: colors.textPrimary }]}>
              {selectedDate ? `Tasks for ${formatDateLabel(selectedDate)}` : "This week"}
            </Text>
            {selectedDate && (
              <TouchableOpacity onPress={resetSelected}>
                <Text style={{ color: colors.accentBlue, fontWeight: "700" }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {!hasAgendaItems ? (
            <View style={[styles.emptyState, { borderColor: colors.borderSubtle }]}>
              <Ionicons name="calendar-outline" size={36} color={colors.textMuted} />
              <Text style={[styles.noTasksText, { color: colors.textMuted, marginTop: 10 }]}>
                {selectedDate ? "No tasks due on this day." : "No upcoming tasks in the next 7 days."}
              </Text>
            </View>
          ) : (
            agendaDays.filter((d) => d.items.length > 0).map((day) => {
              const isOverdue = day.date < todayStr;
              const isExpanded = expandedDays.has(day.date);

              if (!accordionAnims.current[day.date]) {
                accordionAnims.current[day.date] = new Animated.Value(isExpanded ? 1 : 0);
              }
              const anim = accordionAnims.current[day.date];

              const toggleDay = () => {
                const opening = !expandedDays.has(day.date);
                setExpandedDays((prev) => {
                  const next = new Set(prev);
                  opening ? next.add(day.date) : next.delete(day.date);
                  return next;
                });
                Animated.spring(anim, {
                  toValue: opening ? 1 : 0,
                  useNativeDriver: false,
                  speed: 20,
                  bounciness: 4,
                }).start();
              };

              const chevronRotation = anim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "90deg"],
              });

              return (
                <View
                  key={day.date}
                  style={[
                    styles.agendaDayBlock,
                    {
                      borderColor: isOverdue ? "rgba(255,69,58,0.30)" : colors.borderSubtle,
                      backgroundColor: isOverdue
                        ? isDark ? "rgba(255,69,58,0.06)" : "rgba(255,69,58,0.03)"
                        : isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.01)",
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.agendaDayHeader}
                    onPress={toggleDay}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {isOverdue && <Ionicons name="alert-circle" size={14} color="#FF453A" />}
                      <Text style={[styles.agendaDayLabel, { color: isOverdue ? "#FF453A" : colors.textPrimary }]}>
                        {day.label}
                      </Text>
                      <Text style={[styles.agendaMeta, { color: colors.textSecondary }]}>
                        · {day.items.length} {day.items.length === 1 ? "task" : "tasks"}
                      </Text>
                    </View>
                    <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Animated.View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={{ marginTop: 6 }}>
                      {day.items.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.taskCard,
                            {
                              backgroundColor: item.completed
                                ? isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"
                                : colors.surface,
                            },
                          ]}
                          onPress={() => router.push({ pathname: "/edit-task", params: { id: String(item.id) } })}
                          activeOpacity={0.85}
                        >
                          <View style={styles.taskHeaderRow}>
                            <View
                              style={[
                                styles.dot,
                                {
                                  backgroundColor: item.completed
                                    ? colors.textMuted
                                    : difficultyDot[item.difficulty || "medium"],
                                },
                              ]}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.taskTitle,
                                  {
                                    color: colors.textPrimary,
                                    textDecorationLine: item.completed ? "line-through" : "none",
                                    opacity: item.completed ? 0.5 : 1,
                                  },
                                ]}
                              >
                                {item.title}
                              </Text>
                              {!!item.subject && (
                                <Text style={[styles.taskMeta, { color: colors.textSecondary }]}>
                                  {item.subject}
                                </Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.taskFooterRow}>
                            <Text style={[styles.taskDue, { color: isOverdue && !item.completed ? "#FF453A" : colors.textMuted }]}>
                              {isOverdue && !item.completed ? "Overdue · " : "Due "}{item.due_date}
                            </Text>
                            <View style={styles.taskActions}>
                              <TouchableOpacity
                                style={[styles.taskActionBtn, { borderColor: colors.borderSubtle, backgroundColor: isDark ? "#17304C" : "#EAF2FF" }]}
                                onPress={(e) => { e.stopPropagation(); handleToggleComplete(item); }}
                                accessibilityLabel={`Mark ${item.title} complete`}
                              >
                                <Ionicons name="checkmark" size={14} color={isDark ? "#8FC0FF" : "#0A84FF"} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.taskActionBtn, { borderColor: colors.borderSubtle, backgroundColor: isDark ? "#282D37" : "#F2F4F8" }]}
                                onPress={(e) => { e.stopPropagation(); handleQuickActions(item); }}
                                accessibilityLabel={`More actions for ${item.title}`}
                              >
                                <Ionicons name="ellipsis-horizontal" size={14} color={colors.textMuted} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={showYearPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowYearPicker(false)}>
          <TouchableOpacity
            style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            activeOpacity={1}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Year</Text>
            {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2].map((y) => (
              <TouchableOpacity
                key={y}
                style={[styles.modalItem, y === year && { backgroundColor: `${colors.accentBlue}18`, borderRadius: 10 }]}
                onPress={() => { resetSelected(); setYear(y); setShowYearPicker(false); }}
              >
                <Text style={[styles.modalItemText, { color: y === year ? colors.accentBlue : colors.textPrimary, fontWeight: y === year ? "700" : "500" }]}>
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showMonthPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMonthPicker(false)}>
          <TouchableOpacity
            style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            activeOpacity={1}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Month</Text>
            {months.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[styles.modalItem, (i + 1) === month && { backgroundColor: `${colors.accentBlue}18`, borderRadius: 10 }]}
                onPress={() => { resetSelected(); setMonth(i + 1); setShowMonthPicker(false); }}
              >
                <Text style={[styles.modalItemText, { color: (i + 1) === month ? colors.accentBlue : colors.textPrimary, fontWeight: (i + 1) === month ? "700" : "500" }]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
    </SafeAreaView>
  );
}

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
    paddingHorizontal: 8,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 14,
  },
  arrowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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

  headerText: {
    fontSize: 22,
    fontWeight: "800",
  },
  headerYear: {
    fontSize: 16,
    fontWeight: "500",
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
    fontSize: 15,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 36,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 16,
    borderStyle: "dashed",
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
  taskFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    width: "80%",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  modalItemText: {
    fontSize: 17,
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
