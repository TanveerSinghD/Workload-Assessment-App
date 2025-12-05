import { addTask, getTasks } from "@/lib/database";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Task = {
  id: number;
  title: string;
  notes?: string | null;
  difficulty: "easy" | "medium" | "hard";
  due_date?: string | null;
  completed?: number;
};

type PlannedTask = Task & {
  dueDate: Date | null;
  daysUntil: number | null;
  score: number;
  reason: string;
  estMinutes: number;
  energy: "deep" | "shallow";
};

// Parse stored date into a JS Date at midnight
function parseDueDate(due: string | null | undefined) {
  if (!due) return null;
  const parsed = new Date(`${due}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffInDays(date: Date | null) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = date.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function estimateMinutes(task: Task) {
  const base = task.difficulty === "hard" ? 90 : task.difficulty === "medium" ? 45 : 20;
  const title = task.title.toLowerCase();
  const keywords: Record<string, number> = {
    essay: 30,
    project: 40,
    research: 25,
    study: 15,
    quiz: 10,
    exam: 40,
    lab: 25,
    report: 25,
  };
  let bonus = 0;
  Object.keys(keywords).forEach((k) => {
    if (title.includes(k)) bonus += keywords[k];
  });
  return base + bonus;
}

function computeEnergy(task: Task): "deep" | "shallow" {
  if (task.difficulty === "hard") return "deep";
  if (task.difficulty === "medium") return "deep";
  return "shallow";
}

export default function PlannerScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const insets = useSafeAreaInsets();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showHeaderBlur, setShowHeaderBlur] = useState(false);

  // Same global colours as the rest of the app
  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const card = dark ? "#2C2C2E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.16)" : "rgba(150,150,150,0.2)";
  const text = dark ? "#FFFFFF" : "#000000";
  const subtle = dark ? "#9A9A9D" : "#6B6B6C";

  const loadTasks = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setRefreshing(true);
      const data = await getTasks();
      setTasks(Array.isArray(data) ? (data as Task[]) : []);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to load tasks", err);
      setError("Couldn't load tasks. Try reopening the app.");
      setTasks([]);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  // Refresh whenever the tab is focused
  useFocusEffect(
    useCallback(() => {
      loadTasks(false);
    }, [loadTasks])
  );

  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const overdueTasks = useMemo(() => {
    return openTasks
      .map((task) => {
        const dueDate = parseDueDate(task.due_date ?? null);
        const daysUntil = diffInDays(dueDate);
        const reason =
          daysUntil === null
            ? "No due date"
            : daysUntil < 0
            ? `Overdue by ${Math.abs(daysUntil)}d`
            : `Due in ${daysUntil}d`;

        return { ...task, dueDate, daysUntil, reason, score: 0 } as PlannedTask;
      })
      .filter((t) => t.daysUntil !== null && t.daysUntil < 0)
      .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
  }, [openTasks]);
  const stats = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let dueToday = 0;

    openTasks.forEach((task) => {
      const days = diffInDays(parseDueDate(task.due_date ?? null));
      if (days === null) return;
      if (days < 0) overdue += 1;
      if (days <= 3 && days >= 0) dueSoon += 1;
      if (days === 0) dueToday += 1;
    });

    const deep = openTasks.filter((t) => t.difficulty !== "easy").length;
    const quick = openTasks.filter((t) => t.difficulty === "easy").length;

    return { open: openTasks.length, overdue, dueSoon, dueToday, deep, quick };
  }, [openTasks]);

  const agentPlan = useMemo(() => {
    if (openTasks.length === 0) {
      return {
        summary: "Add a task to get a plan.",
        prioritized: [] as PlannedTask[],
        sections: [] as { title: string; hint: string; tasks: PlannedTask[] }[],
        schedule: [] as { title: string; minutes: number; id: number; energy: "deep" | "shallow" }[],
        totalMinutes: 0,
      };
    }

    // Keyword frequency for similarity boost
    const freq = new Map<string, number>();
    openTasks.forEach((t) => {
      t.title
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean)
        .forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
    });

    const ranked: PlannedTask[] = openTasks
      .map((task) => {
        const dueDate = parseDueDate(task.due_date ?? null);
        const daysUntil = diffInDays(dueDate);
        const estMinutes = estimateMinutes(task);
        const energy = computeEnergy(task);

        const urgency = (() => {
          if (daysUntil === null) return 1;
          if (daysUntil < 0) return 9;
          if (daysUntil === 0) return 8;
          if (daysUntil <= 1) return 7;
          if (daysUntil <= 3) return 6;
          if (daysUntil <= 7) return 4;
          if (daysUntil <= 14) return 3;
          return 1;
        })();

        const effort = task.difficulty === "hard" ? 3 : task.difficulty === "medium" ? 2 : 1;
        const similarityBoost = (() => {
          let boost = 0;
          task.title
            .toLowerCase()
            .split(/\W+/)
            .filter(Boolean)
            .forEach((w) => {
              const f = freq.get(w) ?? 0;
              if (f > 1) boost += Math.min(f - 1, 2) * 0.4;
            });
          return boost;
        })();

        const score = urgency + effort + similarityBoost;

        const reasonParts: string[] = [];

        if (daysUntil === null) reasonParts.push("No due date");
        else if (daysUntil < 0) reasonParts.push(`Overdue by ${Math.abs(daysUntil)}d`);
        else if (daysUntil === 0) reasonParts.push("Due today");
        else if (daysUntil === 1) reasonParts.push("Due tomorrow");
        else if (daysUntil <= 7) reasonParts.push(`Due in ${daysUntil}d`);

        if (task.difficulty === "hard") reasonParts.push("High effort");
        else if (task.difficulty === "medium") reasonParts.push("Medium effort");
        else reasonParts.push("Quick win");

        return {
          ...task,
          dueDate,
          daysUntil,
          score,
          reason: reasonParts.join(" · "),
          estMinutes,
          energy,
        } as PlannedTask;
      })
      .sort((a, b) => b.score - a.score);

    const used = new Set<number>();
    const take = (limit: number, filter: (task: PlannedTask) => boolean) => {
      const picked: PlannedTask[] = [];
      for (const t of ranked) {
        if (picked.length >= limit) break;
        if (used.has(t.id)) continue;
        if (!filter(t)) continue;
        used.add(t.id);
        picked.push(t);
      }
      return picked;
    };

    const critical = take(3, () => true);
    const deepWork = take(2, (t) => t.difficulty !== "easy");
    const quickWins = take(3, (t) => t.difficulty === "easy");
    const catchUp = take(2, (t) => t.daysUntil !== null && t.daysUntil < 0);

    const summaryParts: string[] = [];
    if (critical[0]) summaryParts.push(`Start with ${critical[0].title} (${critical[0].reason}).`);
    if (deepWork[0]) summaryParts.push(`Protect one focus block for ${deepWork[0].title}.`);
    if (quickWins.length)
      summaryParts.push(`Clear quick wins: ${quickWins.map((t) => t.title).join(", ")}.`);

    const prioritized = ranked.slice(0, 5);

    // Build simple time-box schedule for today (assumes ~3h block)
    const schedule: { title: string; minutes: number; id: number; energy: "deep" | "shallow" }[] = [];
    let budget = 180; // minutes
    for (const t of ranked) {
      if (schedule.length >= 6) break;
      const slot = Math.min(t.estMinutes, 90);
      if (slot > budget && schedule.length > 0) break;
      schedule.push({ title: t.title, minutes: slot, id: t.id, energy: t.energy });
      budget -= slot;
      if (budget <= 0) break;
    }
    const totalMinutes = schedule.reduce((sum, s) => sum + s.minutes, 0);

    return {
      summary: summaryParts.join(" "),
      prioritized,
      sections: [
        { title: "Critical path", hint: "Highest weighted tasks", tasks: critical },
        { title: "Deep focus block", hint: "60–90 minutes", tasks: deepWork },
        { title: "Quick wins", hint: "Momentum boosters", tasks: quickWins },
        { title: "Catch up", hint: "Overdue or near-miss", tasks: catchUp },
      ].filter((s) => s.tasks.length > 0),
      schedule,
      totalMinutes,
    };
  }, [openTasks]);

  const handleOpenTask = useCallback((id: number) => {
    router.push({ pathname: "/edit-task", params: { id: String(id) } });
  }, []);

  const handleToggleComplete = useCallback(
    async (task: Task) => {
      const markTo = !task.completed;
      const updated = await updateAvailabilityWithFeedback(task.id, markTo, {
        // We fold the success message into the follow-up prompt when marking complete.
        silentSuccess: markTo,
        successMessage: markTo ? "Task marked as complete." : undefined,
      });
      if (!updated) return;

      await loadTasks();

      if (markTo) {
        Alert.alert(
          "Availability updated",
          "Task marked as complete. Add a follow-up checkpoint?",
          [
            { text: "No", style: "cancel" },
            {
              text: "Yes, add follow-up",
              onPress: async () => {
                try {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const due = tomorrow.toISOString().split("T")[0];
                  await addTask({
                    title: `Review ${task.title}`,
                    description: task.notes ?? task.title,
                    difficulty: task.difficulty as "easy" | "medium" | "hard",
                    due_date: due,
                  });
                  await loadTasks();
                  Alert.alert("Follow-up added", "We'll remind you to review this task.");
                } catch (error) {
                  console.error("Failed to add follow-up task", error);
                  Alert.alert("Couldn't add follow-up", "Please try again.");
                }
              },
            },
          ],
          { userInterfaceStyle: dark ? "dark" : "light" }
        );
      }
    },
    [loadTasks, dark]
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

  const goToSection = useCallback((section: "critical" | "deep" | "quick" | "catch") => {
    router.push({ pathname: "/plan-section", params: { section } });
  }, []);

  const goToFilter = useCallback((filter: "overdue" | "today" | "next3" | "next7" | "open") => {
    router.push({ pathname: "/tasks-filter", params: { filter } });
  }, []);

  const headerHeight = insets.top + 15;
  const contentTopPadding = headerHeight + 12;

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const shouldShow = y > 8;
    setShowHeaderBlur((prev) => (prev === shouldShow ? prev : shouldShow));
  }, []);

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: background }}>
    <View style={[styles.container, { backgroundColor: background }]}>
      <BlurView
        intensity={40}
        tint={dark ? "dark" : "light"}
        style={[
          styles.blurHeader,
          { height: headerHeight, opacity: showHeaderBlur ? 1 : 0 },
        ]}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingTop: contentTopPadding }]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
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
        {/* HERO / CONTROL BAR */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: dark ? "#0B1B3A" : "#EAF3FF",
              borderColor: dark ? "#163568" : "#C4D9FF",
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.badgeRow}>
              <Text style={[styles.heroBadge, { color: "#0A84FF", borderColor: "#0A84FF" }]}>
                Planner
              </Text>
              <Text style={[styles.heroBadge, { color: subtle, borderColor: border }]}>Local data</Text>
            </View>

            <TouchableOpacity
              onPress={() => loadTasks(true)}
              style={[
                styles.refreshBtn,
                {
                  backgroundColor: dark ? "#0A84FF22" : "#0A84FF1A",
                  borderColor: dark ? "#0A84FF55" : "#0A84FF44",
                },
              ]}
            >
              <Text style={[styles.refreshText, { color: "#0A84FF" }]}>Refresh plan</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.heroTitle, { color: text }]}>Plan for today</Text>
          <Text style={[styles.heroCopy, { color: subtle }]}>
            Built from your tasks using due dates and effort to set the order.
          </Text>

          <View style={styles.heroStatsRow}>
            <TouchableOpacity
              style={[styles.heroStat, { backgroundColor: dark ? "#12284F" : "#F4F8FF" }]}
              activeOpacity={0.85}
              onPress={() => goToFilter("open")}
            >
              <Text style={[styles.heroStatLabel, { color: subtle }]}>Open</Text>
              <Text style={[styles.heroStatValue, { color: text }]}>{stats.open}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroStat, { backgroundColor: dark ? "#2B1A1A" : "#FFF3F3" }]}
              activeOpacity={0.85}
              onPress={() => goToFilter("overdue")}
            >
              <Text style={[styles.heroStatLabel, { color: subtle }]}>Overdue</Text>
              <Text style={[styles.heroStatValue, { color: text }]}>{stats.overdue}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroStat, { backgroundColor: dark ? "#1B2E1F" : "#F2FFF5" }]}
              activeOpacity={0.85}
              onPress={() => goToFilter("next3")}
            >
              <Text style={[styles.heroStatLabel, { color: subtle }]}>Due soon</Text>
              <Text style={[styles.heroStatValue, { color: text }]}>{stats.dueSoon}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.metaText, { color: subtle }]}>
        {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : "Waiting to load tasks"}
      </Text>
    </View>

        {overdueTasks.length > 0 && (
          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: text }]}>Overdue tasks</Text>
              <Text style={[styles.pill, { color: "#FF3B30", borderColor: border }]}>
                {overdueTasks.length} to fix
              </Text>
            </View>
            <Text style={[styles.sectionHint, { color: subtle }]}>
              Handle these first to get back on track.
            </Text>

            <View style={{ marginTop: 10, gap: 10 }}>
              {overdueTasks.map((task, index) => (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.taskRow,
                    {
                      borderColor: border,
                      backgroundColor: dark ? "#2A1B1B" : "#FFF5F5",
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handleOpenTask(task.id)}
                  onLongPress={() => handleQuickActions(task)}
                >
                  <View style={[styles.rankDot, { backgroundColor: "#FF453A" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, { color: text }]}>{task.title}</Text>
                    <Text style={[styles.taskReason, { color: subtle }]}>
                      {task.reason || `Overdue by ${Math.abs(task.daysUntil ?? 0)}d`}
                    </Text>
                  </View>
                  {task.due_date ? (
                    <Text style={[styles.badge, { color: text }]}>Due {task.due_date}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* PRIORITY PLAN */}
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: text }]}>Today&apos;s game plan</Text>
              <TouchableOpacity
                onPress={() => goToSection("critical")}
                activeOpacity={0.85}
                style={styles.sectionLink}
              >
                <Text style={[styles.pill, { color: dark ? "#4CD964" : "#1FAD4D", borderColor: border }]}>
                  Auto-ranked
                </Text>
                <Ionicons name="chevron-forward" size={18} color={subtle} />
              </TouchableOpacity>
            </View>

          {error ? (
            <Text style={{ color: "#FF3B30" }}>{error}</Text>
          ) : agentPlan.prioritized.length === 0 ? (
            <Text style={[styles.emptyState, { color: subtle }]}>Add a task to generate a plan.</Text>
          ) : (
            <>
              <Text style={[styles.summary, { color: text }]}>{agentPlan.summary}</Text>

              <View style={[styles.scheduleCard, { borderColor: border }]}>
                <View style={styles.scheduleHeader}>
                  <Text style={[styles.sectionTitle, { color: text }]}>Schedule for today</Text>
                  <Text style={[styles.statHint, { color: subtle }]}>{agentPlan.totalMinutes} min planned</Text>
                </View>
                {agentPlan.schedule.length === 0 ? (
                  <Text style={[styles.statHint, { color: subtle }]}>Add tasks to build a schedule.</Text>
                ) : (
                  agentPlan.schedule.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      onPress={() => handleOpenTask(item.id)}
                      onLongPress={() => handleQuickActions({ ...openTasks.find((t) => t.id === item.id)! })}
                      style={styles.scheduleRow}
                    >
                      <View style={[styles.rankDot, { backgroundColor: rankColor(idx) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskTitle, { color: text }]}>{item.title}</Text>
                        <Text style={[styles.taskReason, { color: subtle }]}>
                          {item.minutes} min · {item.energy === "deep" ? "Deep focus" : "Quick win"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              <View style={{ marginTop: 14 }}>
                {agentPlan.prioritized.map((task, index) => (
                  <TouchableOpacity
                    key={task.id}
                    style={[
                      styles.taskRow,
                      {
                        borderColor: border,
                        backgroundColor: dark ? "#1F1F23" : "#F7F8FA",
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => handleOpenTask(task.id)}
                    onLongPress={() => handleQuickActions(task)}
                  >
                    <View style={[styles.rankDot, { backgroundColor: rankColor(index) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, { color: text }]}>{task.title}</Text>
                      <Text style={[styles.taskReason, { color: subtle }]}>{task.reason}</Text>
                    </View>
                    {task.due_date ? (
                      <Text style={[styles.badge, { color: text }]}>Due {task.due_date}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {agentPlan.sections.length > 0 && (
          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: text }]}>Suggested order</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[styles.pill, { color: subtle, borderColor: border }]}>
                  {stats.quick} quick wins · {stats.deep} deep work
                </Text>
                <TouchableOpacity onPress={() => goToSection("quick")} activeOpacity={0.85}>
                  <Ionicons name="chevron-forward" size={18} color={subtle} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.sectionHint, { color: subtle }]}>Based on urgency + effort.</Text>

            <View style={{ gap: 12, marginTop: 12 }}>
              {agentPlan.sections.map((section, i) => (
                <TouchableOpacity
                  key={section.title}
                  style={[styles.flowBlock, { borderColor: border }]}
                  activeOpacity={0.85}
                  onPress={() =>
                    goToSection(
                      section.title === "Critical path"
                        ? "critical"
                        : section.title === "Deep focus block"
                        ? "deep"
                        : section.title === "Quick wins"
                        ? "quick"
                        : "catch"
                    )
                  }
                >
                  <View style={styles.flowHeader}>
                    <View style={styles.flowHeaderLeft}>
                      <View style={[styles.stepDot, { backgroundColor: rankColor(i) }]} />
                      <View>
                        <Text style={[styles.flowTitle, { color: text }]}>{section.title}</Text>
                        <Text style={[styles.flowHint, { color: subtle }]}>{section.hint}</Text>
                      </View>
                    </View>
                    <Text style={[styles.countBadge, { color: subtle }]}>{section.tasks.length} items</Text>
                  </View>
                  {section.tasks.map((task) => (
                    <TouchableOpacity
                      key={task.id}
                      activeOpacity={0.85}
                      onPress={() => handleOpenTask(task.id)}
                      onLongPress={() => handleQuickActions(task)}
                    >
                      <Text style={[styles.flowTask, { color: text }]}>
                        • {task.title} ({task.reason})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>How it works</Text>
          <Text style={[styles.sectionHint, { color: subtle }]}>
            We rank tasks locally using due date + difficulty. Overdue and hard tasks get bumped to the
            top, while easy items are saved as quick wins.
          </Text>
        </View>
      </ScrollView>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 70, // keep clear of tab bar
    gap: 14,
  },
  card: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  sectionLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  summary: {
    fontSize: 16,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    fontSize: 13,
    fontWeight: "700",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  taskReason: {
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  sectionHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  statHint: {
    fontSize: 13,
  },
  flowBlock: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  flowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  flowHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flowTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  flowHint: {
    fontSize: 13,
  },
  flowTask: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    fontSize: 15,
  },
  scheduleCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hero: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  heroBadge: {
    fontSize: 13,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    fontWeight: "700",
  },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: "700",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  heroCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroStat: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
  },
  heroStatLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  metaText: {
    fontSize: 12,
    marginTop: 4,
  },
  blurHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pill: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rankDot: {
    width: 10,
    height: 10,
    borderRadius: 8,
    marginTop: 2,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: "700",
  },
});

// Accent colours for ranked items
function rankColor(index: number) {
  const palette = ["#0A84FF", "#34C759", "#FF9F0A", "#FF453A", "#AF52DE"];
  return palette[index % palette.length];
}
