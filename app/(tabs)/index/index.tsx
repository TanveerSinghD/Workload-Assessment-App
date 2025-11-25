import { getTasks } from "@/app/database/database";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { updateAvailabilityWithFeedback } from "@/utils/availabilityFeedback";
import { Ionicons } from "@expo/vector-icons";
import { useScrollToTop } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Task = {
  id: number;
  title: string;
  notes?: string | null;
  difficulty: "easy" | "medium" | "hard";
  due_date?: string | null;
  completed?: number;
  created_at?: string | null;
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const insets = useSafeAreaInsets();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showHeaderBlur, setShowHeaderBlur] = useState(false);
  const headerHeight = insets.top + 20;

  // Theme colours
  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const card = dark ? "#2C2C2E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(150,150,150,0.2)";
  const text = dark ? "#FFFFFF" : "#000000";
  const subtle = dark ? "#9A9A9D" : "#6B6B6C";

  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);

  const loadTasks = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setRefreshing(true);
      const dbTasks = await getTasks();
      setTasks(Array.isArray(dbTasks) ? (dbTasks as Task[]) : []);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load tasks", err);
      setError("Couldn't load tasks. Pull to refresh or restart.");
      setTasks([]);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks(false);
    }, [loadTasks])
  );

  const dateFromTask = useCallback((task: Task) => {
    if (!task.due_date) return null;
    return new Date(`${task.due_date}T00:00:00`);
  }, []);

  const createdDate = useCallback((task: Task) => {
    if (!task.created_at) return null;
    const d = new Date(task.created_at);
    return Number.isNaN(d.getTime()) ? null : d;
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
  const filteredAssignments = tasks;

  // Overdue + time-based analytics
  const overdueTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.completed && daysDiff(dateFromTask(t)) !== null && (daysDiff(dateFromTask(t)) as number) < 0)
        .sort((a, b) => (daysDiff(dateFromTask(a)) ?? 0) - (daysDiff(dateFromTask(b)) ?? 0)),
    [tasks, daysDiff, dateFromTask]
  );

  const worstOverdue = overdueTasks[0];

  const loadForecast = useMemo(() => {
    let todayCount = 0;
    let next3 = 0;
    let next7 = 0;

    tasks.forEach((t) => {
      if (t.completed) return;
      const diff = daysDiff(dateFromTask(t));
      if (diff === null) return;
      if (diff === 0) todayCount += 1;
      if (diff >= 0 && diff <= 2) next3 += 1;
      if (diff >= 0 && diff <= 6) next7 += 1;
    });

    return { todayCount, next3, next7 };
  }, [tasks, daysDiff, dateFromTask]);

  const difficultyMix = useMemo(() => {
    const open = tasks.filter((t) => !t.completed);
    const easy = open.filter((t) => t.difficulty === "easy").length;
    const medium = open.filter((t) => t.difficulty === "medium").length;
    const hard = open.filter((t) => t.difficulty === "hard").length;
    const total = easy + medium + hard || 1;
    return {
      easy,
      medium,
      hard,
      percents: {
        easy: Math.round((easy / total) * 100),
        medium: Math.round((medium / total) * 100),
        hard: Math.round((hard / total) * 100),
      },
    };
  }, [tasks]);

  const quickWins = useMemo(() => {
    return tasks
      .filter((t) => !t.completed && t.difficulty === "easy")
      .sort((a, b) => {
        const aDiff = daysDiff(dateFromTask(a)) ?? Number.MAX_SAFE_INTEGER;
        const bDiff = daysDiff(dateFromTask(b)) ?? Number.MAX_SAFE_INTEGER;
        return aDiff - bDiff;
      })
      .slice(0, 3);
  }, [tasks, daysDiff, dateFromTask]);

  const recency = useMemo(() => {
    let recent = 0;
    let older = 0;
    tasks.forEach((t) => {
      const created = createdDate(t);
      if (!created) return;
      const diff = (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (diff <= 2) recent += 1;
      else older += 1;
    });
    return { recent, older };
  }, [tasks, createdDate, today]);

  const aging = useMemo(() => {
    return tasks
      .filter((t) => !t.completed)
      .map((t) => {
        const created = createdDate(t);
        const age = created ? Math.round((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)) : null;
        return { ...t, age };
      })
      .filter((t) => t.age !== null)
      .sort((a, b) => (b.age ?? 0) - (a.age ?? 0))
      .slice(0, 3);
  }, [tasks, createdDate, today]);

  const handleOpenTask = useCallback((id: number) => {
    router.push({ pathname: "/edit-task", params: { id: String(id) } });
  }, []);

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

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const shouldShow = y > 8;
      setShowHeaderBlur((prev) => (prev === shouldShow ? prev : shouldShow));
    },
    []
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
            onPress: () => handleOpenTask(task.id),
          },
          { text: "Cancel", style: "cancel" },
        ],
        { userInterfaceStyle: dark ? "dark" : "light" }
      );
    },
    [dark, handleOpenTask, handleToggleComplete]
  );

  const goToFilter = useCallback((filter: "overdue" | "today" | "week" | "next3" | "next7") => {
    router.push({ pathname: "/tasks-filter", params: { filter } });
  }, []);

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: background }}>
    <ThemedView style={[styles.container, { backgroundColor: background }]}>
      {/* Status bar blur overlay for nicer scroll */}
      <BlurView
        intensity={40}
        tint={dark ? "dark" : "light"}
        style={[
          styles.blurHeader,
          { height: headerHeight, opacity: showHeaderBlur ? 1 : 0 },
        ]}
        pointerEvents="none"
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTasks(true)}
            tintColor={dark ? "#FFF" : "#000"}
          />
        }
      >

        {/* TODAY’S OVERVIEW */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: card,
              borderColor: border,
            },
          ]}
        >
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
            Today
          </ThemedText>

          {error ? (
            <ThemedText style={{ color: "#FF3B30" }}>{error}</ThemedText>
          ) : tasks.length === 0 ? (
            <ThemedText style={{ color: subtle }}>
              No tasks added yet.
            </ThemedText>
          ) : (
            <View style={styles.statChipRow}>
              {[
                {
                  label: "Today",
                  value: stats.dueToday,
                  color: "#0A84FF",
                  icon: "sunny",
                  filter: "today" as const,
                },
                {
                  label: "This week",
                  value: stats.dueThisWeek,
                  color: "#30B0C7",
                  icon: "calendar-outline",
                  filter: "week" as const,
                },
                {
                  label: "Overdue",
                  value: stats.overdue,
                  color: "#FF453A",
                  icon: "warning-outline",
                  filter: "overdue" as const,
                },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => goToFilter(item.filter)}
                  activeOpacity={0.9}
                  style={[
                    styles.statChip,
                    {
                      backgroundColor: dark ? "rgba(255,255,255,0.06)" : "#F7F8FA",
                      borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                    },
                  ]}
                >
                  <View style={styles.statChipTop}>
                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                    <Text style={[styles.statChipLabel, { color: subtle }]}>{item.label}</Text>
                  </View>
                  <Text style={[styles.statChipValue, { color: text }]}>{item.value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* HEALTH PANEL */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
            Progress
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

        {/* OVERDUE + FORECAST */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
            Overdue and upcoming
          </ThemedText>
          <View style={styles.statRow}>
            <TouchableOpacity
              style={[styles.statBox, { borderColor: border, backgroundColor: dark ? "#1F1F23" : "#F7F8FA" }]}
              activeOpacity={0.85}
              onPress={() => goToFilter("overdue")}
            >
              <Text style={[styles.statLabel, { color: subtle }]}>Overdue</Text>
              <Text style={[styles.statValue, { color: text }]}>{stats.overdue}</Text>
              {worstOverdue ? (
                <Text style={[styles.statHint, { color: subtle }]} numberOfLines={1}>
                  Oldest: {worstOverdue.title}
                </Text>
              ) : (
                <Text style={[styles.statHint, { color: subtle }]}>Clear</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statBox, { borderColor: border, backgroundColor: dark ? "#1F1F23" : "#F7F8FA" }]}
              activeOpacity={0.85}
              onPress={() => goToFilter("today")}
            >
              <Text style={[styles.statLabel, { color: subtle }]}>Today</Text>
              <Text style={[styles.statValue, { color: text }]}>{loadForecast.todayCount}</Text>
              <Text style={[styles.statHint, { color: subtle }]}>Next 3 days: {loadForecast.next3}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statBox, { borderColor: border, backgroundColor: dark ? "#1F1F23" : "#F7F8FA" }]}
              activeOpacity={0.85}
              onPress={() => goToFilter("next7")}
            >
              <Text style={[styles.statLabel, { color: subtle }]}>Week</Text>
              <Text style={[styles.statValue, { color: text }]}>{loadForecast.next7}</Text>
              <Text style={[styles.statHint, { color: subtle }]}>Due this week</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DIFFICULTY MIX */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
            Difficulty mix
          </ThemedText>
          <Text style={[styles.statHint, { color: subtle }]}>
            {difficultyMix.easy} easy · {difficultyMix.medium} medium · {difficultyMix.hard} hard
          </Text>
          <View style={[styles.barBackground, { backgroundColor: dark ? "#2C2C2E" : "#f0f0f3" }]}>
            <View
              style={[
                styles.barFill,
                { width: `${difficultyMix.percents.easy}%`, backgroundColor: "#4CD964" },
              ]}
            />
            <View
              style={[
                styles.barFill,
                { width: `${difficultyMix.percents.medium}%`, backgroundColor: "#FF9F0A" },
              ]}
            />
            <View
              style={[
                styles.barFill,
                { width: `${difficultyMix.percents.hard}%`, backgroundColor: "#FF453A" },
              ]}
            />
          </View>
        </View>

        {/* QUICK WINS */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
            Quick wins
          </ThemedText>
          {quickWins.length === 0 ? (
            <Text style={[styles.statHint, { color: subtle }]}>No easy tasks queued.</Text>
          ) : (
            quickWins.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={[styles.assignmentCard, { backgroundColor: card, borderColor: border }]}
                activeOpacity={0.85}
                onPress={() => handleOpenTask(task.id)}
                onLongPress={() => handleQuickActions(task)}
              >
                <Text style={{ color: text, fontSize: 16, fontWeight: "700" }}>{task.title}</Text>
                <Text style={{ color: subtle }}>
                  {task.due_date ? `Due ${task.due_date}` : "No due date"}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* RECENCY & AGING */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
            Recent and oldest
          </ThemedText>
          <View style={styles.statRow}>
            <TouchableOpacity
              style={[styles.statBox, { borderColor: border, backgroundColor: dark ? "#1F1F23" : "#F7F8FA" }]}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: "/tasks-filter", params: { filter: "recent" } })}
            >
              <Text style={[styles.statLabel, { color: subtle }]}>Added last 48h</Text>
              <Text style={[styles.statValue, { color: text }]}>{recency.recent}</Text>
              <Text style={[styles.statHint, { color: subtle }]}>Older tasks: {recency.older}</Text>
            </TouchableOpacity>
            <View
              style={[
                styles.statBox,
                { flex: 2, borderColor: border, backgroundColor: dark ? "#1F1F23" : "#F7F8FA" },
              ]}
            >
              <Text style={[styles.statLabel, { color: subtle }]}>Oldest open items</Text>
              {aging.length === 0 ? (
                <Text style={[styles.statHint, { color: subtle }]}>No open tasks</Text>
              ) : (
                aging.map((t) => (
                  <Text key={t.id} style={{ color: text }} numberOfLines={1}>
                    • {t.title} ({t.age}d)
                  </Text>
                ))
              )}
            </View>
          </View>
        </View>

      </ScrollView>
    </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 15,
  },
  scrollContent: {
    paddingBottom: 50, // avoid tab bar overlap
  },
  blurHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 20,
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
  statChipRow: {
    flexDirection: "row",
    gap: 12,
  },
  statChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
    alignItems: "center",
  },
  statChipTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  statChipLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  statChipValue: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  statLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  statHint: {
    fontSize: 13,
    marginTop: 4,
  },
  barBackground: {
    width: "100%",
    height: 12,
    borderRadius: 8,
    overflow: "hidden",
    flexDirection: "row",
    marginTop: 10,
  },
  barFill: {
    height: "100%",
  },

  assignmentCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
});
