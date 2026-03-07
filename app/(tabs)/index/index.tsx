import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColors } from "../../../hooks/use-theme-colors";
import { getTasks } from "@/lib/database";
import { FocusSessionSnapshot, loadFocusSessionSnapshot } from "@/lib/focus-session-storage";
import { emitTabBarScroll } from "@/lib/tab-bar-scroll";
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
  Pressable,
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

const DIFFICULTY_RANK: Record<Task["difficulty"], number> = {
  hard: 0,
  medium: 1,
  easy: 2,
};

function formatTimer(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

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
  const [focusSnapshot, setFocusSnapshot] = useState<FocusSessionSnapshot | null>(null);
  const headerHeight = insets.top + 8;

  // Theme colours (unified)
  const colors = useThemeColors();
  const background = colors.background;
  const card = colors.surface;
  const border = colors.borderSubtle;
  const text = colors.textPrimary;
  const subtle = colors.textMuted;
  const surfaceElevated = colors.surfaceElevated;
  const success = colors.successGreen;
  const warning = colors.warningYellow;
  const danger = colors.dangerRed;

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
      let active = true;
      const load = async () => {
        await loadTasks(false);
        const snapshot = await loadFocusSessionSnapshot();
        if (!active) return;
        setFocusSnapshot(snapshot);
      };
      load();
      return () => {
        active = false;
      };
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

  const recommendedFocusTask = useMemo(() => {
    const open = tasks.filter((t) => !t.completed);
    if (!open.length) return null;

    return [...open].sort((a, b) => {
      const dueA = daysDiff(dateFromTask(a));
      const dueB = daysDiff(dateFromTask(b));
      if (dueA === null && dueB !== null) return 1;
      if (dueA !== null && dueB === null) return -1;
      if (dueA !== null && dueB !== null && dueA !== dueB) return dueA - dueB;

      const rank = (DIFFICULTY_RANK[a.difficulty] ?? 3) - (DIFFICULTY_RANK[b.difficulty] ?? 3);
      if (rank !== 0) return rank;
      return a.title.localeCompare(b.title);
    })[0];
  }, [dateFromTask, daysDiff, tasks]);

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

  const resumableFocus = useMemo(() => {
    if (!focusSnapshot || !focusSnapshot.taskId) return null;
    if (focusSnapshot.sessionState !== "running" && focusSnapshot.sessionState !== "paused") return null;
    if (Date.now() - focusSnapshot.updatedAt > 1000 * 60 * 60 * 8) return null;

    const task = tasks.find((item) => item.id === focusSnapshot.taskId && !item.completed);
    if (!task) return null;
    return {
      task,
      remainingSeconds: focusSnapshot.remainingSeconds,
      sessionState: focusSnapshot.sessionState,
    };
  }, [focusSnapshot, tasks]);

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
      emitTabBarScroll({ source: "home", y });
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

  const completionPercent = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

  const focusStatus = useMemo(() => {
    if (stats.overdue > 0) return { label: "Needs attention", color: danger };
    if (stats.dueToday > 0) return { label: "In progress", color: warning };
    return { label: "On track", color: success };
  }, [danger, stats.dueToday, stats.overdue, success, warning]);

  const progressChartData = useMemo(() => {
    if (stats.total === 0) {
      return [{ value: 1, color: dark ? "#2A2E39" : "#E7EAF1" }];
    }
    return [
      { value: stats.openTasks, color: subtle },
      { value: stats.completed, color: success },
    ];
  }, [dark, stats.completed, stats.openTasks, stats.total, subtle, success]);

  const formatDueText = useCallback(
    (task: Task) => {
      const diff = daysDiff(dateFromTask(task));
      if (diff === null) return "No due date";
      if (diff < 0) return `Overdue ${Math.abs(Math.round(diff))}d`;
      if (diff === 0) return "Due today";
      if (diff === 1) return "Due tomorrow";
      return `Due in ${Math.round(diff)}d`;
    },
    [dateFromTask, daysDiff]
  );

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: background }}>
      <ThemedView style={[styles.container, { backgroundColor: background }]}>
        <BlurView
          intensity={40}
          tint={dark ? "dark" : "light"}
          style={[styles.blurHeader, { height: headerHeight, opacity: showHeaderBlur ? 1 : 0 }]}
          pointerEvents="none"
        />

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight, paddingBottom: insets.bottom + 120 },
          ]}
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
          <View style={[styles.heroCard, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.heroHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={[styles.heroTitle, { color: text }]}>
                  Today focus
                </ThemedText>
                <Text style={[styles.heroSubtitle, { color: subtle }]}>
                  {tasks.length === 0
                    ? "Build momentum by adding your first task."
                    : `You have ${stats.openTasks} open task${stats.openTasks === 1 ? "" : "s"}.`}
                </Text>
              </View>
              <View style={[styles.focusStatusPill, { backgroundColor: `${focusStatus.color}20`, borderColor: `${focusStatus.color}55` }]}>
                <Text style={[styles.focusStatusText, { color: focusStatus.color }]}>{focusStatus.label}</Text>
              </View>
            </View>

            {error ? (
              <View style={[styles.emptyStateBox, { borderColor: border, backgroundColor: surfaceElevated }]}>
                <Text style={[styles.errorText, { color: danger }]}>{error}</Text>
                <Pressable
                  onPress={() => loadTasks(true)}
                  accessibilityLabel="Retry loading tasks"
                  style={({ pressed }) => [
                    styles.ghostBtn,
                    { borderColor: border, backgroundColor: card },
                    pressed && styles.pressableDown,
                  ]}
                >
                  <Text style={[styles.ghostBtnText, { color: text }]}>Retry</Text>
                </Pressable>
              </View>
            ) : tasks.length === 0 ? (
              <View style={[styles.emptyStateBox, { borderColor: border, backgroundColor: surfaceElevated }]}>
                <Text style={[styles.emptyStateTitle, { color: text }]}>No tasks yet</Text>
                <Text style={[styles.emptyStateSub, { color: subtle }]}>
                  Add your first task to unlock smart planning and quick actions.
                </Text>
                <View style={styles.heroActions}>
                  <Pressable
                    onPress={() => router.push("/add-assignment")}
                    accessibilityLabel="Add first task"
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { backgroundColor: colors.accentBlue },
                      pressed && styles.pressableDown,
                    ]}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>Add first task</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                {resumableFocus ? (
                  <Pressable
                    onPress={() => router.push({ pathname: "/focus-session", params: { id: String(resumableFocus.task.id) } })}
                    accessibilityLabel="Resume active focus session"
                    style={({ pressed }) => [
                      styles.resumeChip,
                      { borderColor: border, backgroundColor: surfaceElevated },
                      pressed && styles.pressableDown,
                    ]}
                  >
                    <Ionicons name={resumableFocus.sessionState === "running" ? "play-circle" : "pause-circle"} size={14} color={colors.accentBlue} />
                    <Text style={[styles.resumeChipText, { color: text }]} numberOfLines={1}>
                      Resume {formatTimer(resumableFocus.remainingSeconds)} - {resumableFocus.task.title}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.focusGrid}>
                  {[
                    {
                      label: "Overdue",
                      value: stats.overdue,
                      hint: worstOverdue ? "Needs recovery" : "All clear",
                      icon: "warning-outline",
                      color: danger,
                      filter: "overdue" as const,
                    },
                    {
                      label: "Due today",
                      value: loadForecast.todayCount,
                      hint: loadForecast.todayCount > 0 ? "Prioritize now" : "No deadlines",
                      icon: "sunny-outline",
                      color: "#0A84FF",
                      filter: "today" as const,
                    },
                    {
                      label: "Next 7 days",
                      value: loadForecast.next7,
                      hint: `${loadForecast.next3} due in 3 days`,
                      icon: "calendar-outline",
                      color: "#34C759",
                      filter: "next7" as const,
                    },
                  ].map((item) => (
                    <Pressable
                      key={item.label}
                      onPress={() => goToFilter(item.filter)}
                      accessibilityLabel={`Open ${item.label} tasks`}
                      style={({ pressed }) => [
                        styles.focusMetric,
                        {
                          borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                          backgroundColor: surfaceElevated,
                        },
                        pressed && styles.pressableDown,
                      ]}
                    >
                      <View style={styles.focusMetricHead}>
                        <Ionicons name={item.icon as any} size={15} color={item.color} />
                        <Text style={[styles.focusMetricLabel, { color: subtle }]}>{item.label}</Text>
                      </View>
                      <Text style={[styles.focusMetricValue, { color: text }]}>{item.value}</Text>
                      <Text style={[styles.focusMetricHint, { color: subtle }]} numberOfLines={1}>
                        {item.hint}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.heroActions}>
                  <Pressable
                    onPress={() =>
                      router.push(
                        recommendedFocusTask
                          ? { pathname: "/focus-session", params: { id: String(recommendedFocusTask.id) } }
                          : "/focus-session"
                      )
                    }
                    accessibilityLabel="Start focus session"
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { backgroundColor: colors.accentBlue },
                      pressed && styles.pressableDown,
                    ]}
                  >
                    <Ionicons name="play-forward" size={15} color="#fff" />
                    <Text style={styles.primaryBtnText}>Start focus</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/add-assignment")}
                    accessibilityLabel="Add a task"
                    style={({ pressed }) => [
                      styles.ghostBtn,
                      { borderColor: border, backgroundColor: surfaceElevated },
                      pressed && styles.pressableDown,
                    ]}
                  >
                    <Ionicons name="add" size={15} color={text} />
                    <Text style={[styles.ghostBtnText, { color: text }]}>Add task</Text>
                  </Pressable>
                </View>

                {worstOverdue ? (
                  <Text style={[styles.heroFootnote, { color: subtle }]} numberOfLines={1}>
                    Oldest overdue: {worstOverdue.title}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.sectionHead}>
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
                Progress
              </ThemedText>
              <Text style={[styles.sectionHeadSub, { color: subtle }]}>
                {stats.completed} complete / {stats.openTasks} open
              </Text>
            </View>

            <View style={styles.progressBody}>
              <View style={styles.donutWrap}>
                <PieChart donut radius={68} innerRadius={45} data={progressChartData} />
                <View style={styles.donutCenter}>
                  <Text style={[styles.donutPercent, { color: text }]}>{completionPercent}%</Text>
                  <Text style={[styles.donutLabel, { color: subtle }]}>complete</Text>
                </View>
              </View>

              <View style={styles.progressMeta}>
                <View style={styles.progressRow}>
                  <Text style={[styles.progressLabel, { color: subtle }]}>Total tasks</Text>
                  <Text style={[styles.progressValue, { color: text }]}>{stats.total}</Text>
                </View>
                <View style={styles.progressRow}>
                  <Text style={[styles.progressLabel, { color: subtle }]}>Due this week</Text>
                  <Text style={[styles.progressValue, { color: text }]}>{stats.dueThisWeek}</Text>
                </View>
                <View style={styles.progressRow}>
                  <Text style={[styles.progressLabel, { color: subtle }]}>Added last 48h</Text>
                  <Text style={[styles.progressValue, { color: text }]}>{recency.recent}</Text>
                </View>
              </View>
            </View>

            <Text style={[styles.mixSummary, { color: subtle }]}>
              {difficultyMix.easy} easy · {difficultyMix.medium} medium · {difficultyMix.hard} hard
            </Text>
            <View style={[styles.barBackground, { backgroundColor: surfaceElevated }]}>
              <View style={[styles.barFill, { width: `${difficultyMix.percents.easy}%`, backgroundColor: success }]} />
              <View style={[styles.barFill, { width: `${difficultyMix.percents.medium}%`, backgroundColor: warning }]} />
              <View style={[styles.barFill, { width: `${difficultyMix.percents.hard}%`, backgroundColor: danger }]} />
            </View>
            <View style={styles.mixLegendRow}>
              <Text style={[styles.mixLegendText, { color: success }]}>Easy {difficultyMix.percents.easy}%</Text>
              <Text style={[styles.mixLegendText, { color: warning }]}>Medium {difficultyMix.percents.medium}%</Text>
              <Text style={[styles.mixLegendText, { color: danger }]}>Hard {difficultyMix.percents.hard}%</Text>
            </View>
          </View>

          <View style={[styles.card, styles.primaryActionCard, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.sectionHeadRow}>
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
                Quick wins
              </ThemedText>
              <Pressable
                onPress={() => router.push("/(tabs)/tasks/tasks")}
                accessibilityLabel="View all tasks"
                style={({ pressed }) => [styles.inlineLink, pressed && styles.pressableDown]}
              >
                <Text style={[styles.inlineLinkText, { color: colors.accentBlue }]}>View all</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.accentBlue} />
              </Pressable>
            </View>

            {quickWins.length === 0 ? (
              <View style={[styles.emptyStateBox, { borderColor: border, backgroundColor: surfaceElevated }]}>
                <Text style={[styles.emptyStateSub, { color: subtle }]}>
                  No easy tasks queued. Tackle a medium task next.
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/tasks/tasks")}
                  accessibilityLabel="Open tasks list"
                  style={({ pressed }) => [
                    styles.ghostBtn,
                    { borderColor: border, backgroundColor: card, alignSelf: "flex-start" },
                    pressed && styles.pressableDown,
                  ]}
                >
                  <Text style={[styles.ghostBtnText, { color: text }]}>Open tasks</Text>
                </Pressable>
              </View>
            ) : (
              quickWins.map((task) => (
                <Pressable
                  key={task.id}
                  accessibilityLabel={`Open quick win task ${task.title}`}
                  onPress={() => handleOpenTask(task.id)}
                  style={({ pressed }) => [
                    styles.assignmentCard,
                    { backgroundColor: surfaceElevated, borderColor: border },
                    pressed && styles.pressableDown,
                  ]}
                >
                  <View style={styles.assignmentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.assignmentTitle, { color: text }]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      <Text
                        style={[
                          styles.assignmentMeta,
                          { color: formatDueText(task).startsWith("Overdue") ? danger : subtle },
                        ]}
                      >
                        {formatDueText(task)}
                      </Text>
                    </View>
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
                          handleQuickActions(task);
                        }}
                        accessibilityLabel={`More actions for ${task.title}`}
                      >
                        <Ionicons name="ellipsis-horizontal" size={14} color={subtle} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>

          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.sectionHead}>
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: text }]}>
                Insights
              </ThemedText>
              <Text style={[styles.sectionHeadSub, { color: subtle }]}>Upcoming pressure and aging tasks</Text>
            </View>

            <View style={styles.insightGrid}>
              <Pressable
                onPress={() => goToFilter("next3")}
                accessibilityLabel="Open tasks due in next 3 days"
                style={({ pressed }) => [
                  styles.insightTile,
                  { borderColor: border, backgroundColor: surfaceElevated },
                  pressed && styles.pressableDown,
                ]}
              >
                <Text style={[styles.insightLabel, { color: subtle }]}>Due in 3 days</Text>
                <Text style={[styles.insightValue, { color: text }]}>{loadForecast.next3}</Text>
                <Text style={[styles.insightHint, { color: subtle }]}>Next 7 days: {loadForecast.next7}</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push({ pathname: "/tasks-filter", params: { filter: "recent" } })}
                accessibilityLabel="Open recently added tasks"
                style={({ pressed }) => [
                  styles.insightTile,
                  { borderColor: border, backgroundColor: surfaceElevated },
                  pressed && styles.pressableDown,
                ]}
              >
                <Text style={[styles.insightLabel, { color: subtle }]}>Added in 48h</Text>
                <Text style={[styles.insightValue, { color: text }]}>{recency.recent}</Text>
                <Text style={[styles.insightHint, { color: subtle }]}>Older tasks: {recency.older}</Text>
              </Pressable>
            </View>

            <View style={[styles.oldestBox, { borderColor: border, backgroundColor: surfaceElevated }]}>
              <Text style={[styles.insightLabel, { color: subtle }]}>Oldest open items</Text>
              {aging.length === 0 ? (
                <Text style={[styles.insightHint, { color: subtle }]}>No open tasks</Text>
              ) : (
                aging.map((task) => (
                  <Text key={task.id} style={[styles.oldestItem, { color: text }]} numberOfLines={1}>
                    • {task.title} ({task.age}d)
                  </Text>
                ))
              )}
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
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 14,
  },
  blurHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 20,
  },
  pressableDown: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: "800",
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  focusStatusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  focusStatusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  focusGrid: {
    flexDirection: "row",
    gap: 8,
  },
  focusMetric: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 94,
  },
  focusMetricHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  focusMetricLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  focusMetricValue: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  focusMetricHint: {
    fontSize: 12,
    marginTop: 3,
  },
  heroActions: {
    flexDirection: "row",
    gap: 8,
  },
  resumeChip: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 36,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resumeChipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  primaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  ghostBtn: {
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  ghostBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  heroFootnote: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyStateBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  emptyStateSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  primaryActionCard: {
    borderWidth: 1.2,
  },
  sectionHead: {
    gap: 2,
  },
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 0,
  },
  sectionHeadSub: {
    fontSize: 12,
  },
  progressBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  donutWrap: {
    width: 142,
    height: 142,
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  donutPercent: {
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 26,
  },
  donutLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  progressMeta: {
    flex: 1,
    gap: 9,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  progressLabel: {
    fontSize: 13,
  },
  progressValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  mixSummary: {
    fontSize: 13,
    marginTop: 2,
  },
  barBackground: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    marginTop: 2,
  },
  barFill: {
    height: "100%",
  },
  mixLegendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  mixLegendText: {
    fontSize: 12,
    fontWeight: "700",
  },
  inlineLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  inlineLinkText: {
    fontSize: 13,
    fontWeight: "800",
  },
  assignmentCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  assignmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  assignmentMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  taskActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  taskActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  insightGrid: {
    flexDirection: "row",
    gap: 8,
  },
  insightTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 90,
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  insightValue: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  insightHint: {
    fontSize: 12,
    marginTop: 4,
  },
  oldestBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  oldestItem: {
    fontSize: 13,
    fontWeight: "600",
  },
});
