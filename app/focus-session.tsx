import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  FocusSessionSnapshot,
  FocusSessionState,
  clearFocusSessionSnapshot,
  loadFocusSessionSnapshot,
  saveFocusSessionSnapshot,
} from "@/lib/focus-session-storage";
import { addTask, getTasks, setTaskCompleted, updateTaskDueDate } from "@/lib/database";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { SafeAreaView } from "react-native-safe-area-context";

type Task = {
  id: number;
  title: string;
  notes?: string | null;
  difficulty: "easy" | "medium" | "hard";
  priority?: "normal" | "high" | null;
  category?: "coursework" | "revision" | "project" | "personal" | null;
  due_date?: string | null;
  completed?: number;
  created_at?: string | null;
};

type SuggestionTab = "queue" | "planner";

type PlannerSuggestion = {
  key: string;
  title: string;
  description: string;
  reason: string;
  tag: "Quick win" | "Urgent" | "Balance difficulty";
  difficulty: "easy" | "medium" | "hard";
  due_date: string | null;
};

type ToastTone = "info" | "success" | "warning";

const SESSION_STALE_MS = 1000 * 60 * 60 * 8;
const TIMER_PRESETS = [15, 25, 45] as const;
const MILESTONES = [300, 60, 0] as const;

const DIFFICULTY_RANK: Record<Task["difficulty"], number> = {
  hard: 0,
  medium: 1,
  easy: 2,
};

function normalizePriority(task: Pick<Task, "priority" | "notes">): "normal" | "high" {
  if (task.priority === "high" || task.priority === "normal") return task.priority;
  if (task.notes && /priority:\s*high/i.test(task.notes)) return "high";
  return "normal";
}

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

function toISODateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODateLocal(d);
}

function formatTimer(totalSeconds: number) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function extractSubject(title: string) {
  const match = title.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() ?? "";
}

function sortFocusQueue(tasks: Task[], today: Date) {
  return [...tasks]
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const dueA = daysDiff(dateFromTask(a), today);
      const dueB = daysDiff(dateFromTask(b), today);
      if (dueA === null && dueB !== null) return 1;
      if (dueA !== null && dueB === null) return -1;
      if (dueA !== null && dueB !== null && dueA !== dueB) return dueA - dueB;

      const priorityA = normalizePriority(a) === "high" ? 0 : 1;
      const priorityB = normalizePriority(b) === "high" ? 0 : 1;
      if (priorityA !== priorityB) return priorityA - priorityB;

      const rank = (DIFFICULTY_RANK[a.difficulty] ?? 3) - (DIFFICULTY_RANK[b.difficulty] ?? 3);
      if (rank !== 0) return rank;

      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdA - createdB;
    });
}

function dueLabel(task: Task, today: Date) {
  const diff = daysDiff(dateFromTask(task), today);
  if (diff === null) return "No due date";
  if (diff < 0) return `Overdue ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

function getSuggestionTag(task: Task, today: Date): "Quick win" | "Urgent" | "Balance difficulty" {
  const due = daysDiff(dateFromTask(task), today);
  if (due !== null && due < 0) return "Urgent";
  if (normalizePriority(task) === "high") return "Urgent";
  if (task.difficulty === "easy") return "Quick win";
  return "Balance difficulty";
}

function normalizeTimerMinutes(minutes: number) {
  return TIMER_PRESETS.includes(minutes as (typeof TIMER_PRESETS)[number]) ? minutes : 25;
}

export default function FocusSessionScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const background = colors.background;
  const card = colors.surface;
  const surfaceElevated = colors.surfaceElevated;
  const border = colors.borderSubtle;
  const text = colors.textPrimary;
  const subtle = colors.textMuted;
  const accent = colors.accentBlue;
  const success = colors.successGreen;
  const warning = colors.warningYellow;
  const danger = colors.dangerRed;

  const preferredId = useMemo(() => {
    if (!id) return null;
    const parsed = Number(id);
    return Number.isFinite(parsed) ? parsed : null;
  }, [id]);

  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<Task[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [sessionState, setSessionState] = useState<FocusSessionState>("ready");

  const [showDetails, setShowDetails] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionTab, setSuggestionTab] = useState<SuggestionTab>("queue");
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [addingSuggestionKey, setAddingSuggestionKey] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);

  const taskCardAnim = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestoneSentRef = useRef<Set<number>>(new Set());

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    setToast({ message, tone });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setToast(null);
      });
    }, 2200);
  }, [toastAnim]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const animateTaskCard = useCallback(() => {
    taskCardAnim.setValue(0.975);
    Animated.spring(taskCardAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 16,
      bounciness: 5,
    }).start();
  }, [taskCardAnim]);

  const resetTimerForContext = useCallback((minutes: number) => {
    setSessionState("ready");
    setRemainingSeconds(minutes * 60);
    milestoneSentRef.current.clear();
  }, []);

  const loadQueue = useCallback(
    async (preferred?: number | null, snapshot?: FocusSessionSnapshot | null) => {
      try {
        setLoading(true);
        const allTasks = (await getTasks()) as Task[];
        const sorted = sortFocusQueue(Array.isArray(allTasks) ? allTasks : [], today);
        setQueue(sorted);

        if (!sorted.length) {
          setCurrentId(null);
          setSessionState("ready");
          setRemainingSeconds(selectedMinutes * 60);
          await clearFocusSessionSnapshot();
          return;
        }

        const preferredIdToUse = preferred ?? snapshot?.taskId ?? preferredId;
        const preferredExists = preferredIdToUse && sorted.some((task) => task.id === preferredIdToUse);
        const currentExists = currentId && sorted.some((task) => task.id === currentId);
        const resolvedId = (preferredExists ? preferredIdToUse : currentExists ? currentId : sorted[0].id) as number;
        setCurrentId(resolvedId);

        const canRestore =
          snapshot &&
          snapshot.taskId === resolvedId &&
          Date.now() - snapshot.updatedAt < SESSION_STALE_MS &&
          snapshot.remainingSeconds >= 0;

        if (canRestore) {
          const restoredMinutes = normalizeTimerMinutes(snapshot.selectedMinutes);
          setSelectedMinutes(restoredMinutes);
          setRemainingSeconds(Math.min(snapshot.remainingSeconds, restoredMinutes * 60));
          setSessionState(snapshot.sessionState === "running" ? "paused" : snapshot.sessionState);
        } else {
          setSessionState("ready");
          setRemainingSeconds(selectedMinutes * 60);
        }
      } catch (error) {
        if (__DEV__) console.error("Failed to load focus queue", error);
        setQueue([]);
        setCurrentId(null);
      } finally {
        setLoading(false);
      }
    },
    [currentId, preferredId, selectedMinutes, today]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const hydrate = async () => {
        const snapshot = await loadFocusSessionSnapshot();
        if (!active) return;
        await loadQueue(preferredId ?? snapshot?.taskId ?? null, snapshot);
      };

      hydrate();

      return () => {
        active = false;
      };
    }, [loadQueue, preferredId])
  );

  const currentTask = useMemo(
    () => queue.find((task) => task.id === currentId) ?? null,
    [currentId, queue]
  );

  const queuePosition = useMemo(() => {
    if (!currentTask) return 0;
    const idx = queue.findIndex((task) => task.id === currentTask.id);
    return idx >= 0 ? idx + 1 : 0;
  }, [currentTask, queue]);

  const elapsedSeconds = useMemo(
    () => Math.max(0, selectedMinutes * 60 - remainingSeconds),
    [remainingSeconds, selectedMinutes]
  );

  const hasMeaningfulProgress = elapsedSeconds >= 90 || sessionState === "finished";

  const timerProgress = useMemo(() => {
    const total = selectedMinutes * 60;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, elapsedSeconds / total));
  }, [elapsedSeconds, selectedMinutes]);

  const timerAccent = useMemo(() => {
    if (remainingSeconds <= 60) return danger;
    if (remainingSeconds <= 300) return warning;
    return accent;
  }, [accent, danger, remainingSeconds, warning]);

  const timerChartData = useMemo(() => {
    const done = Math.max(0.0001, timerProgress * 100);
    const left = Math.max(0.0001, 100 - done);
    return [
      { value: done, color: timerAccent },
      { value: left, color: dark ? "#2C3039" : "#DFE5ED" },
    ];
  }, [dark, timerAccent, timerProgress]);

  const upNextTasks = useMemo(() => {
    if (!currentTask) return [];
    return queue.filter((task) => task.id !== currentTask.id).slice(0, 4);
  }, [currentTask, queue]);

  const plannerSuggestions = useMemo<PlannerSuggestion[]>(() => {
    if (!currentTask) return [];

    const openTitles = new Set(queue.map((task) => task.title.trim().toLowerCase()));
    const subject = extractSubject(currentTask.title);
    const topic = subject || currentTask.title;
    const dueBase = currentTask.due_date ?? toISODateLocal(today);

    const candidates: PlannerSuggestion[] = [
      {
        key: "breakdown",
        title: `Break down ${topic} into 3 steps`,
        description: `Create 3 mini-actions for "${currentTask.title}" to start quickly.`,
        reason: "Reduces overwhelm and friction.",
        tag: "Quick win",
        difficulty: "easy",
        due_date: dueBase,
      },
      {
        key: "review-notes",
        title: `Review notes for ${topic}`,
        description: "Spend 10-15 minutes summarizing key points.",
        reason: "Builds clarity before deep work.",
        tag: "Balance difficulty",
        difficulty: "easy",
        due_date: addDaysISO(dueBase, 1),
      },
      {
        key: "catchup-sweep",
        title: "Run a 20-minute catch-up sweep",
        description: "Clear one overdue item and one quick task.",
        reason: "Helps recover when backlog grows.",
        tag: "Urgent",
        difficulty: "medium",
        due_date: toISODateLocal(today),
      },
      {
        key: "tomorrow-plan",
        title: "Plan tomorrow's top 3 priorities",
        description: "Set tomorrow's top tasks now to avoid startup friction.",
        reason: "Improves momentum for the next day.",
        tag: "Balance difficulty",
        difficulty: "medium",
        due_date: addDaysISO(toISODateLocal(today), 1),
      },
    ];

    return candidates
      .filter((item) => !openTitles.has(item.title.trim().toLowerCase()))
      .filter((item) => !dismissedSuggestions.has(item.key))
      .slice(0, 4);
  }, [currentTask, dismissedSuggestions, queue, today]);

  const taskPriorityTone = useMemo(() => {
    if (!currentTask) return subtle;
    const label = dueLabel(currentTask, today);
    if (label.startsWith("Overdue")) return danger;
    if (label === "Due today") return warning;
    return subtle;
  }, [currentTask, danger, subtle, today, warning]);

  useEffect(() => {
    setShowDetails(false);
    animateTaskCard();
  }, [animateTaskCard, currentId]);

  useEffect(() => {
    if (sessionState !== "running") return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setSessionState("finished");
          showToast("Session complete. Choose your next step.", "success");
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionState, showToast]);

  useEffect(() => {
    if (sessionState !== "running" && remainingSeconds !== 0) return;

    MILESTONES.forEach((milestone) => {
      if (remainingSeconds !== milestone || milestoneSentRef.current.has(milestone)) return;
      milestoneSentRef.current.add(milestone);
      if (milestone === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);
      }
    });
  }, [remainingSeconds, sessionState]);

  useEffect(() => {
    if (!currentTask) {
      clearFocusSessionSnapshot();
      return;
    }

    if (sessionState === "running" && remainingSeconds > 0 && remainingSeconds % 10 !== 0) return;

    saveFocusSessionSnapshot({
      taskId: currentTask.id,
      selectedMinutes,
      remainingSeconds,
      sessionState,
      updatedAt: Date.now(),
    });
  }, [currentTask, remainingSeconds, selectedMinutes, sessionState]);

  const selectTaskForFocus = useCallback(
    (taskId: number) => {
      setCurrentId(taskId);
      resetTimerForContext(selectedMinutes);
      showToast("Switched focus task.", "info");
    },
    [resetTimerForContext, selectedMinutes, showToast]
  );

  const handlePresetSelect = useCallback(
    (minutes: number) => {
      setSelectedMinutes(minutes);
      resetTimerForContext(minutes);
      showToast(`Timer set to ${minutes}m.`, "info");
    },
    [resetTimerForContext, showToast]
  );

  const handlePrimaryTimerAction = useCallback(() => {
    if (sessionState === "running") {
      setSessionState("paused");
      showToast("Session paused.", "info");
      return;
    }

    if (sessionState === "finished") {
      resetTimerForContext(selectedMinutes);
      showToast("Timer restarted.", "info");
      return;
    }

    setSessionState("running");
    showToast("Focus started.", "success");
  }, [resetTimerForContext, selectedMinutes, sessionState, showToast]);

  const handleReset = useCallback(() => {
    resetTimerForContext(selectedMinutes);
    showToast("Timer reset.", "info");
  }, [resetTimerForContext, selectedMinutes, showToast]);

  const doComplete = useCallback(async () => {
    if (!currentTask) return;
    try {
      await setTaskCompleted(currentTask.id, true);
      setSessionState("ready");
      await loadQueue();
      showToast("Task completed.", "success");
    } catch (error) {
      if (__DEV__) console.error("Failed to complete task", error);
      Alert.alert("Complete failed", "Please try again.");
    }
  }, [currentTask, loadQueue, showToast]);

  const handleComplete = useCallback(() => {
    if (!currentTask) return;

    if (!hasMeaningfulProgress) {
      Alert.alert(
        "Mark complete already?",
        `You focused for ${Math.max(0, Math.floor(elapsedSeconds / 60))} min. Complete anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Complete", onPress: () => doComplete() },
        ]
      );
      return;
    }

    doComplete();
  }, [currentTask, doComplete, elapsedSeconds, hasMeaningfulProgress]);

  const handleSnooze = useCallback(
    async (days: number) => {
      if (!currentTask) return;
      try {
        const baseISO = currentTask.due_date ?? toISODateLocal(today);
        await updateTaskDueDate(currentTask.id, addDaysISO(baseISO, days));
        setSessionState("ready");
        await loadQueue();
        showToast(`Snoozed +${days} day${days === 1 ? "" : "s"}.`, "info");
      } catch (error) {
        if (__DEV__) console.error("Failed to snooze task", error);
        Alert.alert("Snooze failed", "Please try again.");
      }
    },
    [currentTask, loadQueue, showToast, today]
  );

  const openSnoozeMenu = useCallback(() => {
    Alert.alert("Snooze task", "Move this task forward by:", [
      { text: "+1 day", onPress: () => handleSnooze(1) },
      { text: "+3 days", onPress: () => handleSnooze(3) },
      { text: "+7 days", onPress: () => handleSnooze(7) },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handleSnooze]);

  const handleSkip = useCallback(() => {
    if (!currentTask || queue.length <= 1) {
      handleReset();
      return;
    }
    const idx = queue.findIndex((task) => task.id === currentTask.id);
    const next = queue[(idx + 1) % queue.length];
    selectTaskForFocus(next.id);
  }, [currentTask, handleReset, queue, selectTaskForFocus]);

  const handleDismissSuggestion = useCallback((key: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(key));
    showToast("Suggestion dismissed for this session.", "info");
  }, [showToast]);

  const handleCreateSuggestedTask = useCallback(
    async (suggestion: PlannerSuggestion) => {
      try {
        setAddingSuggestionKey(suggestion.key);
        await addTask({
          title: suggestion.title,
          description: suggestion.description,
          difficulty: suggestion.difficulty,
          due_date: suggestion.due_date,
        });
        animateTaskCard();
        await loadQueue();
        showToast("Suggested task added.", "success");
      } catch (error) {
        if (__DEV__) console.error("Failed to add suggested task", error);
        Alert.alert("Could not add task", "Please try again.");
      } finally {
        setAddingSuggestionKey(null);
      }
    },
    [animateTaskCard, loadQueue, showToast]
  );

  const primaryTimerLabel =
    sessionState === "running"
      ? "Pause"
      : sessionState === "paused"
      ? "Resume"
      : sessionState === "finished"
      ? "Restart"
      : "Start";

  const primaryTimerColor =
    sessionState === "running" ? "#FF9F0A" : sessionState === "paused" ? "#0A84FF" : accent;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      <View style={[styles.container, { backgroundColor: background }]}>
        {toast ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.toast,
              {
                borderColor: border,
                backgroundColor:
                  toast.tone === "success"
                    ? dark
                      ? "#1C3324"
                      : "#EAF9EF"
                    : toast.tone === "warning"
                    ? dark
                      ? "#3C2F1A"
                      : "#FFF6E6"
                    : dark
                    ? "#1E2B3D"
                    : "#EAF2FF",
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={[styles.toastText, { color: text }]}>{toast.message}</Text>
          </Animated.View>
        ) : null}

        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.iconBtn,
              { borderColor: border, backgroundColor: card, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Ionicons name="arrow-back" size={18} color={text} />
          </Pressable>

          <View style={styles.topTitleWrap}>
            <Text style={[styles.topTitle, { color: text }]}>Focus Session</Text>
            <Text style={[styles.topSub, { color: subtle }]}>One task at a time</Text>
          </View>

          <Pressable
            onPress={() => router.push("/(tabs)/tasks/tasks")}
            accessibilityLabel="Open tasks list"
            style={({ pressed }) => [
              styles.iconBtn,
              { borderColor: border, backgroundColor: card, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Ionicons name="list" size={18} color={text} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={[styles.helperText, { color: subtle }]}>Loading focus queue...</Text>
          </View>
        ) : !currentTask ? (
          <View style={[styles.emptyCard, { borderColor: border, backgroundColor: card }]}>
            <Text style={[styles.emptyTitle, { color: text }]}>No open tasks to focus on</Text>
            <Text style={[styles.emptySub, { color: subtle }]}>Add a task or reopen one from completed tasks.</Text>
            <View style={styles.emptyActions}>
              <Pressable
                onPress={() => router.push("/add-assignment")}
                accessibilityLabel="Add task"
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: accent, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.primaryBtnText}>Add task</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/(tabs)/tasks/tasks")}
                accessibilityLabel="Open tasks"
                style={({ pressed }) => [
                  styles.ghostBtn,
                  { borderColor: border, backgroundColor: surfaceElevated, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.ghostBtnText, { color: text }]}>Open tasks</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Animated.View style={{ transform: [{ scale: taskCardAnim }] }}>
              <View style={[styles.taskCard, { borderColor: border, backgroundColor: card }]}>
                <View style={styles.taskTopMetaRow}>
                  <Text style={[styles.queueMeta, { color: subtle }]}>Task {queuePosition} of {queue.length}</Text>
                  <View style={[styles.priorityPill, { borderColor: border, backgroundColor: `${taskPriorityTone}22` }]}>
                    <Text style={[styles.priorityText, { color: taskPriorityTone }]}>{dueLabel(currentTask, today)}</Text>
                  </View>
                </View>

                <Text style={[styles.taskTitle, { color: text }]} numberOfLines={2}>
                  {currentTask.title}
                </Text>

                {currentTask.notes?.trim() ? (
                  <>
                    <Text style={[styles.taskNotes, { color: subtle }]} numberOfLines={showDetails ? 6 : 2}>
                      {currentTask.notes?.trim()}
                    </Text>
                    <Pressable
                      onPress={() => setShowDetails((prev) => !prev)}
                      accessibilityLabel={showDetails ? "Hide task details" : "Show task details"}
                      style={({ pressed }) => [styles.detailsBtn, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={[styles.detailsBtnText, { color: accent }]}>
                        {showDetails ? "Hide details" : "Details"}
                      </Text>
                      <Ionicons name={showDetails ? "chevron-down" : "chevron-up"} size={12} color={accent} />
                    </Pressable>
                  </>
                ) : (
                  <Text style={[styles.taskNotes, { color: subtle }]}>No notes added.</Text>
                )}

                <View style={styles.metaChipRow}>
                  <View
                    style={[
                      styles.metaChip,
                      {
                        borderColor: border,
                        backgroundColor:
                          currentTask.difficulty === "hard"
                            ? dark
                              ? "#4A2222"
                              : "#FFECEC"
                            : currentTask.difficulty === "medium"
                            ? dark
                              ? "#4A4022"
                              : "#FFF8E6"
                            : dark
                            ? "#1F3A2B"
                            : "#E9FFF1",
                      },
                    ]}
                  >
                    <Text style={[styles.metaChipText, { color: text }]}>Effort: {currentTask.difficulty}</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            <View style={[styles.timerCard, { borderColor: border, backgroundColor: card }]}>
              <Text style={[styles.timerTitle, { color: text }]}>Focus timer</Text>

              <View style={styles.presetRow}>
                {TIMER_PRESETS.map((minutes) => (
                  <Pressable
                    key={minutes}
                    onPress={() => handlePresetSelect(minutes)}
                    accessibilityLabel={`Set ${minutes} minute timer`}
                    style={({ pressed }) => [
                      styles.presetBtn,
                      {
                        borderColor: selectedMinutes === minutes ? accent : border,
                        backgroundColor: selectedMinutes === minutes ? `${accent}22` : surfaceElevated,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.presetText, { color: selectedMinutes === minutes ? accent : text }]}>{minutes}m</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.timerCenterWrap}>
                <PieChart donut radius={90} innerRadius={72} data={timerChartData} />
                <View style={styles.timerCenterOverlay}>
                  <Text
                    style={[styles.timerText, { color: text }]}
                    accessibilityLabel={`Timer ${formatTimer(remainingSeconds)}. State ${sessionState}.`}
                  >
                    {formatTimer(remainingSeconds)}
                  </Text>
                  <Text style={[styles.timerStateText, { color: sessionState === "running" ? timerAccent : subtle }]}>
                    {sessionState === "finished"
                      ? "Finished"
                      : sessionState === "running"
                      ? "Running"
                      : sessionState === "paused"
                      ? "Paused"
                      : "Ready"}
                  </Text>
                </View>
              </View>

              <View style={styles.timerControls}>
                <Pressable
                  onPress={handlePrimaryTimerAction}
                  accessibilityLabel={`${primaryTimerLabel} timer`}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: primaryTimerColor, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons
                    name={
                      sessionState === "running"
                        ? "pause"
                        : sessionState === "finished"
                        ? "refresh"
                        : "play"
                    }
                    size={14}
                    color="#fff"
                  />
                  <Text style={styles.primaryBtnText}>{primaryTimerLabel}</Text>
                </Pressable>

                <Pressable
                  onPress={handleReset}
                  accessibilityLabel="Reset timer"
                  style={({ pressed }) => [
                    styles.ghostBtn,
                    { borderColor: border, backgroundColor: surfaceElevated, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.ghostBtnText, { color: text }]}>Reset</Text>
                </Pressable>
              </View>
            </View>

            {sessionState === "finished" ? (
              <View style={[styles.finishCard, { borderColor: border, backgroundColor: card }]}>
                <Text style={[styles.timerTitle, { color: text }]}>Session complete</Text>
                <Text style={[styles.helperText, { color: subtle }]}>Choose the next step for this task.</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={handleComplete}
                    accessibilityLabel="Complete task"
                    style={({ pressed }) => [
                      styles.actionBtnPrimary,
                      { backgroundColor: success, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={styles.actionText}>Complete</Text>
                  </Pressable>
                  <Pressable
                    onPress={openSnoozeMenu}
                    accessibilityLabel="Snooze task"
                    style={({ pressed }) => [
                      styles.actionBtnPrimary,
                      { backgroundColor: accent, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Ionicons name="time-outline" size={14} color="#fff" />
                    <Text style={styles.actionText}>Snooze</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSkip}
                    accessibilityLabel="Focus next task"
                    style={({ pressed }) => [
                      styles.actionBtnSecondary,
                      { borderColor: border, backgroundColor: surfaceElevated, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Ionicons name="play-skip-forward" size={14} color={text} />
                    <Text style={[styles.actionSecondaryText, { color: text }]}>Next</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[styles.actionCard, { borderColor: border, backgroundColor: card }]}>
                <Text style={[styles.timerTitle, { color: text }]}>Task actions</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={handleComplete}
                    accessibilityLabel="Complete task"
                    style={({ pressed }) => [
                      hasMeaningfulProgress ? styles.actionBtnPrimary : styles.actionBtnSecondary,
                      hasMeaningfulProgress
                        ? { backgroundColor: success, opacity: pressed ? 0.85 : 1 }
                        : {
                            borderColor: border,
                            backgroundColor: surfaceElevated,
                            opacity: pressed ? 0.85 : 1,
                          },
                    ]}
                  >
                    <Ionicons name="checkmark" size={14} color={hasMeaningfulProgress ? "#fff" : text} />
                    <Text style={hasMeaningfulProgress ? styles.actionText : [styles.actionSecondaryText, { color: text }]}>Complete</Text>
                  </Pressable>

                  <Pressable
                    onPress={openSnoozeMenu}
                    accessibilityLabel="Snooze task"
                    style={({ pressed }) => [
                      styles.actionBtnPrimary,
                      { backgroundColor: accent, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Ionicons name="time-outline" size={14} color="#fff" />
                    <Text style={styles.actionText}>Snooze</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSkip}
                    accessibilityLabel="Skip to next task"
                    style={({ pressed }) => [
                      styles.actionBtnSecondary,
                      { borderColor: border, backgroundColor: surfaceElevated, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Ionicons name="play-skip-forward" size={14} color={text} />
                    <Text style={[styles.actionSecondaryText, { color: text }]}>Skip</Text>
                  </Pressable>
                </View>
                <Text style={[styles.helperText, { color: subtle }]}>Complete becomes primary after meaningful focus time.</Text>
              </View>
            )}

            <View style={[styles.suggestionCard, { borderColor: border, backgroundColor: card }]}>
              <View style={styles.suggestionHeadRow}>
                <Text style={[styles.timerTitle, { color: text }]}>Suggestions</Text>
                <Pressable
                  onPress={() => setSuggestionsOpen((prev) => !prev)}
                  accessibilityLabel={suggestionsOpen ? "Hide suggestions" : "Show suggestions"}
                  style={({ pressed }) => [styles.showMoreBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={[styles.showMoreText, { color: accent }]}>{suggestionsOpen ? "Hide" : "Show"}</Text>
                  <Ionicons name={suggestionsOpen ? "chevron-down" : "chevron-up"} size={12} color={accent} />
                </Pressable>
              </View>

              {suggestionsOpen ? (
                <>
                  <View style={styles.tabRow}>
                    {([
                      { key: "queue", label: "Next in queue" },
                      { key: "planner", label: "Planner ideas" },
                    ] as const).map((tab) => (
                      <Pressable
                        key={tab.key}
                        onPress={() => setSuggestionTab(tab.key)}
                        accessibilityLabel={`Open ${tab.label} tab`}
                        style={({ pressed }) => [
                          styles.tabBtn,
                          {
                            borderColor: suggestionTab === tab.key ? accent : border,
                            backgroundColor: suggestionTab === tab.key ? `${accent}20` : surfaceElevated,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.tabText, { color: suggestionTab === tab.key ? accent : text }]}>{tab.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {suggestionTab === "queue" ? (
                    upNextTasks.length === 0 ? (
                      <Text style={[styles.helperText, { color: subtle }]}>No other open tasks right now.</Text>
                    ) : (
                      upNextTasks.map((task) => {
                        const tag = getSuggestionTag(task, today);
                        return (
                          <Pressable
                            key={task.id}
                            onPress={() => selectTaskForFocus(task.id)}
                            accessibilityLabel={`Focus on ${task.title}`}
                            style={({ pressed }) => [
                              styles.suggestedTaskRow,
                              { borderColor: border, backgroundColor: surfaceElevated, opacity: pressed ? 0.85 : 1 },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.suggestedTaskTitle, { color: text }]} numberOfLines={1}>{task.title}</Text>
                              <Text style={[styles.suggestedTaskMeta, { color: subtle }]} numberOfLines={1}>{dueLabel(task, today)}</Text>
                            </View>
                            <View style={[styles.reasonChip, { backgroundColor: `${accent}1A`, borderColor: border }]}>
                              <Text style={[styles.reasonChipText, { color: accent }]}>{tag}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={14} color={subtle} />
                          </Pressable>
                        );
                      })
                    )
                  ) : plannerSuggestions.length === 0 ? (
                    <Text style={[styles.helperText, { color: subtle }]}>No planner ideas right now.</Text>
                  ) : (
                    plannerSuggestions.map((item) => (
                      <View key={item.key} style={[styles.plannerSuggestRow, { borderColor: border, backgroundColor: surfaceElevated }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.suggestedTaskTitle, { color: text }]} numberOfLines={1}>{item.title}</Text>
                          <Text style={[styles.suggestedTaskMeta, { color: subtle }]} numberOfLines={2}>{item.reason}</Text>
                          <View style={[styles.reasonChip, { backgroundColor: `${accent}1A`, borderColor: border }]}> 
                            <Text style={[styles.reasonChipText, { color: accent }]}>{item.tag}</Text>
                          </View>
                        </View>
                        <View style={styles.suggestionActionsCol}>
                          <Pressable
                            onPress={() => handleCreateSuggestedTask(item)}
                            disabled={addingSuggestionKey === item.key}
                            accessibilityLabel={`Add suggested task ${item.title}`}
                            style={({ pressed }) => [
                              styles.addSuggestBtn,
                              {
                                borderColor: border,
                                backgroundColor:
                                  addingSuggestionKey === item.key ? (dark ? "#2E3440" : "#E7EAF0") : `${accent}20`,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                          >
                            {addingSuggestionKey === item.key ? (
                              <ActivityIndicator size="small" color={subtle} />
                            ) : (
                              <>
                                <Ionicons name="add" size={13} color={accent} />
                                <Text style={[styles.addSuggestText, { color: accent }]}>Add</Text>
                              </>
                            )}
                          </Pressable>

                          <Pressable
                            onPress={() => handleDismissSuggestion(item.key)}
                            accessibilityLabel={`Dismiss suggestion ${item.title}`}
                            style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.8 }]}
                          >
                            <Text style={[styles.dismissText, { color: subtle }]}>Not now</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </>
              ) : (
                <Text style={[styles.helperText, { color: subtle }]}>Show suggestions if you want ideas for what to do next.</Text>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    paddingBottom: 22,
    gap: 12,
  },
  toast: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 38,
    paddingHorizontal: 12,
    justifyContent: "center",
    marginBottom: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "700",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  topTitleWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  topTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  topSub: {
    fontSize: 12,
    fontWeight: "600",
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyActions: {
    flexDirection: "row",
    gap: 8,
  },
  taskCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  taskTopMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  queueMeta: {
    fontSize: 12,
    fontWeight: "700",
  },
  priorityPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "800",
  },
  taskTitle: {
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
  },
  taskNotes: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  metaChipRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  metaChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  timerCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  timerTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  presetText: {
    fontSize: 14,
    fontWeight: "700",
  },
  timerCenterWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  timerCenterOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: 132,
  },
  timerText: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
  timerStateText: {
    fontSize: 13,
    fontWeight: "800",
  },
  timerControls: {
    flexDirection: "row",
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  ghostBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 6,
  },
  ghostBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  finishCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 9,
  },
  actionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 9,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtnPrimary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },
  actionBtnSecondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },
  actionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  actionSecondaryText: {
    fontSize: 13,
    fontWeight: "800",
  },
  helperText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  suggestionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  suggestionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  showMoreText: {
    fontSize: 12,
    fontWeight: "800",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "800",
  },
  suggestedTaskRow: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestedTaskTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  suggestedTaskMeta: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  reasonChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reasonChipText: {
    fontSize: 10,
    fontWeight: "800",
  },
  plannerSuggestRow: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestionActionsCol: {
    alignItems: "flex-end",
    gap: 6,
  },
  addSuggestBtn: {
    borderWidth: 1,
    borderRadius: 999,
    minWidth: 66,
    height: 34,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  addSuggestText: {
    fontSize: 12,
    fontWeight: "800",
  },
  dismissBtn: {
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  dismissText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
