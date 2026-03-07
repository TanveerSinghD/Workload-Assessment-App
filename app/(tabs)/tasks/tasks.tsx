import {
  deleteTask,
  duplicateTask,
  getTasks,
  setTaskCompleted,
  updateManyTaskDueDates,
} from "@/lib/database";
import { emitTabBarScroll } from "@/lib/tab-bar-scroll";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColors } from "../../../hooks/use-theme-colors";
import { Ionicons } from "@expo/vector-icons";
import { useScrollToTop } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
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
  created_at?: string | null;
};

type FocusFilter = "all" | "easy" | "medium" | "hard";
type SortOption = "due" | "hard" | "recent";

type DisplayTask = Task & {
  daysUntil: number | null;
};

type TaskSection = {
  key: string;
  title: string;
  data: DisplayTask[];
  allData: DisplayTask[];
  subtitle: string;
};

const PREVIEW_LIMIT = 3;

function sectionMeta(key: TaskSection["key"], dark: boolean) {
  if (key === "overdue") {
    return {
      icon: "warning-outline" as const,
      accent: "#FF453A",
      sectionBg: dark ? "#2A1C1C" : "#FFF5F5",
      sectionBorder: dark ? "#5A2A2A" : "#FFD7D7",
      rowBg: dark ? "#341F1F" : "#FFF9F9",
      rowBorder: dark ? "#6A2F2F" : "#FFDADA",
    };
  }
  if (key === "today") {
    return {
      icon: "sunny-outline" as const,
      accent: "#0A84FF",
      sectionBg: dark ? "#16233A" : "#F1F7FF",
      sectionBorder: dark ? "#294A7A" : "#CFE2FF",
      rowBg: dark ? "#1A2C47" : "#F7FBFF",
      rowBorder: dark ? "#325A92" : "#D9E9FF",
    };
  }
  return {
    icon: "calendar-outline" as const,
    accent: "#34C759",
    sectionBg: dark ? "#17271D" : "#F3FFF6",
    sectionBorder: dark ? "#2F6A43" : "#CDEFD8",
    rowBg: dark ? "#1D3124" : "#F9FFFB",
    rowBorder: dark ? "#3A7B52" : "#D8F4E1",
  };
}

function dateFromTask(task: Task) {
  if (!task.due_date) return null;
  const date = new Date(`${task.due_date}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createdFromTask(task: Task) {
  if (!task.created_at) return null;
  const date = new Date(task.created_at);
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

function formatDueLabel(task: DisplayTask) {
  if (task.daysUntil === null) return "No due date";
  if (task.daysUntil < 0) return `Overdue ${Math.abs(task.daysUntil)}d`;
  if (task.daysUntil === 0) return "Due today";
  if (task.daysUntil === 1) return "Due tomorrow";
  return `Due in ${task.daysUntil}d`;
}

function getShortDescription(notes?: string | null) {
  if (!notes) return "";
  const words = notes.trim().split(/\s+/);
  return words.slice(0, 8).join(" ") + (words.length > 8 ? "..." : "");
}

function scoreTaskMatch(query: string, task: Task) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 0;

  const title = task.title.toLowerCase();
  const notes = (task.notes ?? "").toLowerCase();
  const titleWords = title.split(/\s+/).filter(Boolean);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  let score = 0;

  if (title === normalized) score += 120;
  if (title.startsWith(normalized)) score += 90;
  if (title.includes(normalized)) score += 55;
  if (titleWords.some((word) => word.startsWith(normalized))) score += 70;
  if (notes.includes(normalized)) score += 20;

  tokens.forEach((token) => {
    if (title.includes(token)) score += 14;
    if (titleWords.some((word) => word.startsWith(token))) score += 10;
    if (notes.includes(token)) score += 4;
  });

  return score;
}

const DIFFICULTY_RANK: Record<Task["difficulty"], number> = {
  hard: 0,
  medium: 1,
  easy: 2,
};

export default function TasksScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const colors = useThemeColors();
  const { filter: initialFilterParam } = useLocalSearchParams<{ filter?: string }>();

  const background = colors.background;
  const card = colors.surface;
  const border = colors.borderSubtle;
  const text = colors.textPrimary;
  const subtle = colors.textMuted;
  const accent = colors.accentBlue;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showHeaderBlur, setShowHeaderBlur] = useState(false);
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("due");
  const [search, setSearch] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [taskListModal, setTaskListModal] = useState<{ title: string; tasks: DisplayTask[] } | null>(null);

  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 8;

  const listRef = useRef<SectionList<DisplayTask, TaskSection>>(null);
  useScrollToTop(listRef);

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
    } catch (error) {
      console.error("Failed to load tasks", error);
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

  useEffect(() => {
    const f = (initialFilterParam ?? "").toLowerCase();
    if (f === "easy" || f === "medium" || f === "hard") setFocusFilter(f);
    else setFocusFilter("all");
  }, [initialFilterParam]);

  const openTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);

  const focusCounts = useMemo(() => {
    let easy = 0;
    let medium = 0;
    let hard = 0;

    openTasks.forEach((task) => {
      if (task.difficulty === "easy") easy += 1;
      else if (task.difficulty === "medium") medium += 1;
      else hard += 1;
    });

    return {
      open: openTasks.length,
      easy,
      medium,
      hard,
    };
  }, [openTasks]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    const withMeta: DisplayTask[] = openTasks
      .map((task) => ({
        ...task,
        daysUntil: daysDiff(dateFromTask(task), today),
      }))
      .filter((task) => {
        if (focusFilter === "easy" || focusFilter === "medium" || focusFilter === "hard") {
          if (task.difficulty !== focusFilter) return false;
        }

        if (!query) return true;
        const haystack = `${task.title} ${task.notes ?? ""}`.toLowerCase();
        return haystack.includes(query);
      });

    const sorted = [...withMeta].sort((a, b) => {
      if (sortBy === "hard") {
        const rank = (DIFFICULTY_RANK[a.difficulty] ?? 3) - (DIFFICULTY_RANK[b.difficulty] ?? 3);
        if (rank !== 0) return rank;
      }

      if (sortBy === "recent") {
        const createdA = createdFromTask(a)?.getTime() ?? 0;
        const createdB = createdFromTask(b)?.getTime() ?? 0;
        if (createdA !== createdB) return createdB - createdA;
      }

      const aDue = a.daysUntil;
      const bDue = b.daysUntil;
      if (aDue === null && bDue === null) return 0;
      if (aDue === null) return 1;
      if (bDue === null) return -1;
      if (aDue !== bDue) return aDue - bDue;

      const rank = (DIFFICULTY_RANK[a.difficulty] ?? 3) - (DIFFICULTY_RANK[b.difficulty] ?? 3);
      if (rank !== 0) return rank;
      return a.title.localeCompare(b.title);
    });

    return sorted;
  }, [focusFilter, openTasks, search, sortBy, today]);

  const searchSuggestions = useMemo(() => {
    const query = search.trim();
    if (!query || batchMode) return [];

    const candidates = openTasks
      .filter((task) => {
        if (focusFilter === "easy" || focusFilter === "medium" || focusFilter === "hard") {
          return task.difficulty === focusFilter;
        }
        return true;
      })
      .map((task) => {
        const daysUntil = daysDiff(dateFromTask(task), today);
        return {
          task: { ...task, daysUntil } as DisplayTask,
          score: scoreTaskMatch(query, task),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        const aDue = a.task.daysUntil;
        const bDue = b.task.daysUntil;
        if (aDue === null && bDue === null) return a.task.title.localeCompare(b.task.title);
        if (aDue === null) return 1;
        if (bDue === null) return -1;
        if (aDue !== bDue) return aDue - bDue;
        return a.task.title.localeCompare(b.task.title);
      });

    return candidates.slice(0, 3).map((item) => item.task);
  }, [batchMode, focusFilter, openTasks, search, today]);

  const sections = useMemo(() => {
    const overdue = visibleTasks.filter((task) => task.daysUntil !== null && task.daysUntil < 0);
    const dueToday = visibleTasks.filter((task) => task.daysUntil === 0);
    const upcoming = visibleTasks.filter((task) => task.daysUntil === null || task.daysUntil > 0);

    return [
      { key: "overdue", title: "Overdue", subtitle: "Handle first to get back on track", allData: overdue },
      { key: "today", title: "Due today", subtitle: "Prioritize today’s deadlines", allData: dueToday },
      { key: "upcoming", title: "Upcoming", subtitle: "Plan these next", allData: upcoming },
    ]
      .filter((section) => section.allData.length > 0)
      .map((section) => ({ ...section, data: section.allData.slice(0, PREVIEW_LIMIT) })) as TaskSection[];
  }, [visibleTasks]);

  const selectedTasks = useMemo(
    () => openTasks.filter((task) => selectedIds.has(task.id)),
    [openTasks, selectedIds]
  );

  const selectedCount = selectedIds.size;

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleBatchMode = useCallback(() => {
    setBatchMode((prev) => {
      if (prev) clearSelection();
      return !prev;
    });
  }, [clearSelection]);

  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleOpenTask = useCallback(
    (task: Task) => {
      if (batchMode) {
        toggleSelected(task.id);
        return;
      }
      router.push({ pathname: "/edit-task", params: { id: String(task.id) } });
    },
    [batchMode, toggleSelected]
  );

  const handleTaskLongPress = useCallback((task: Task) => {
    setBatchMode(true);
    setSelectedIds(new Set([task.id]));
  }, []);

  const handleMarkDone = useCallback(
    async (task: Task) => {
      const nextState = !task.completed;
      await setTaskCompleted(task.id, nextState);
      await loadTasks();
      if (batchMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }
    },
    [batchMode, loadTasks]
  );

  const handleDuplicate = useCallback(
    async (task: Task) => {
      try {
        await duplicateTask(task.id);
        await loadTasks();
      } catch (error) {
        console.error("Failed to duplicate task", error);
        Alert.alert("Duplicate failed", "Please try duplicating again.");
      }
    },
    [loadTasks]
  );

  const handleDelete = useCallback(
    (task: Task) => {
      Alert.alert(
        "Delete task?",
        `This will remove "${task.title}".`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteTask(task.id);
                await loadTasks();
              } catch (error) {
                console.error("Failed to delete task", error);
                Alert.alert("Delete failed", "Please retry in a moment.");
              }
            },
          },
        ],
        { userInterfaceStyle: dark ? "dark" : "light" }
      );
    },
    [dark, loadTasks]
  );

  const openQuickActions = useCallback(
    (task: Task) => {
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
    },
    [dark, handleDelete, handleDuplicate, handleMarkDone]
  );

  const handleBatchComplete = useCallback(async () => {
    if (selectedTasks.length === 0) return;
    await Promise.all(selectedTasks.map((task) => setTaskCompleted(task.id, true)));
    clearSelection();
    setBatchMode(false);
    await loadTasks();
  }, [clearSelection, loadTasks, selectedTasks]);

  const runBatchReschedule = useCallback(
    async (mode: "plus1" | "plus7" | "clear") => {
      if (selectedTasks.length === 0) return;

      const todayISO = toISODateLocal(today);
      const updates = selectedTasks.map((task) => {
        if (mode === "clear") {
          return { id: task.id, due_date: null as string | null };
        }
        const baseISO = task.due_date ?? todayISO;
        const moved = addDaysISO(baseISO, mode === "plus1" ? 1 : 7);
        return { id: task.id, due_date: moved };
      });

      await updateManyTaskDueDates(updates);
      clearSelection();
      setBatchMode(false);
      await loadTasks();
    },
    [clearSelection, loadTasks, selectedTasks, today]
  );

  const handleBatchReschedule = useCallback(() => {
    Alert.alert(
      "Reschedule selected",
      `Update ${selectedCount} selected task${selectedCount === 1 ? "" : "s"}.`,
      [
        { text: "+1 day", onPress: () => runBatchReschedule("plus1") },
        { text: "+7 days", onPress: () => runBatchReschedule("plus7") },
        { text: "Clear due date", onPress: () => runBatchReschedule("clear") },
        { text: "Cancel", style: "cancel" },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  }, [dark, runBatchReschedule, selectedCount]);

  const handleBatchDelete = useCallback(() => {
    if (selectedTasks.length === 0) return;
    Alert.alert(
      "Delete selected tasks?",
      `This will delete ${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await Promise.all(selectedTasks.map((task) => deleteTask(task.id)));
            clearSelection();
            setBatchMode(false);
            await loadTasks();
          },
        },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  }, [clearSelection, dark, loadTasks, selectedTasks]);

  const clearFilters = useCallback(() => {
    setFocusFilter("all");
    setSearch("");
    setSortBy("due");
    setBatchMode(false);
    clearSelection();
  }, [clearSelection]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const shouldShow = y > 8;
    setShowHeaderBlur((prev) => (prev === shouldShow ? prev : shouldShow));
    emitTabBarScroll({ source: "tasks", y });
  }, []);

  const renderRowActions = useCallback(
    (task: DisplayTask) => (
      <View style={styles.taskActions}>
        <TouchableOpacity
          style={[
            styles.taskActionBtn,
            { borderColor: border, backgroundColor: dark ? "#17304C" : "#EAF2FF" },
          ]}
          onPress={(event) => {
            event.stopPropagation();
            handleMarkDone(task);
          }}
          accessibilityLabel={`Mark ${task.title} done`}
        >
          <Ionicons name="checkmark" size={14} color={dark ? "#8FC0FF" : "#0A84FF"} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.taskActionBtn,
            { borderColor: border, backgroundColor: dark ? "#282D37" : "#F2F4F8" },
          ]}
          onPress={(event) => {
            event.stopPropagation();
            openQuickActions(task);
          }}
          accessibilityLabel={`More actions for ${task.title}`}
        >
          <Ionicons name="ellipsis-horizontal" size={14} color={subtle} />
        </TouchableOpacity>
      </View>
    ),
    [border, dark, handleMarkDone, openQuickActions, subtle]
  );

  const renderTaskCard = useCallback(
    (
      task: DisplayTask,
      sectionKey: TaskSection["key"],
      index: number,
      total: number,
      hasFooter: boolean
    ) => {
      const selected = selectedIds.has(task.id);
      const meta = sectionMeta(sectionKey, dark);
      const rowShape =
        total === 1
          ? hasFooter
            ? styles.taskGroupSingleWithFooter
            : styles.taskGroupSingleNoFooter
          : index === 0
          ? styles.taskGroupFirst
          : index === total - 1
          ? hasFooter
            ? styles.taskGroupLastWithFooter
            : styles.taskGroupLast
          : styles.taskGroupMiddle;
      return (
        <Pressable
          onPress={() => handleOpenTask(task)}
          onLongPress={() => handleTaskLongPress(task)}
          style={[
            styles.taskGroupRow,
            rowShape,
            {
              borderColor: selected ? accent : meta.sectionBorder,
              backgroundColor: meta.rowBg,
            },
          ]}
        >
          <View style={styles.taskHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskTitle, { color: text }]} numberOfLines={2}>
                {task.title}
              </Text>
              <Text
                style={[
                  styles.taskSub,
                  {
                    color: sectionKey === "upcoming" ? subtle : meta.accent,
                    fontWeight: sectionKey === "upcoming" ? "600" : "700",
                  },
                ]}
              >
                {formatDueLabel(task)}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <View
                style={[
                  styles.difficultyPill,
                  {
                    borderColor: border,
                    backgroundColor:
                      task.difficulty === "hard"
                        ? dark
                          ? "#4A2222"
                          : "#FFECEC"
                        : task.difficulty === "medium"
                        ? dark
                          ? "#4A4022"
                          : "#FFF8E6"
                        : dark
                        ? "#1F3A2B"
                        : "#E9FFF1",
                  },
                ]}
              >
                <Text style={[styles.difficultyText, { color: text }]}>
                  {task.difficulty.charAt(0).toUpperCase() + task.difficulty.slice(1)}
                </Text>
              </View>

              {batchMode ? (
                <TouchableOpacity
                  style={[
                    styles.selectionBtn,
                    { borderColor: selected ? accent : border, backgroundColor: selected ? `${accent}22` : "transparent" },
                  ]}
                  onPress={(event) => {
                    event.stopPropagation();
                    toggleSelected(task.id);
                  }}
                >
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={selected ? accent : subtle}
                  />
                </TouchableOpacity>
              ) : (
                renderRowActions(task)
              )}
            </View>
          </View>

          {task.notes ? (
            <Text style={[styles.taskNotes, { color: subtle }]} numberOfLines={2}>
              {getShortDescription(task.notes)}
            </Text>
          ) : null}
        </Pressable>
      );
    },
    [accent, batchMode, border, dark, handleOpenTask, handleTaskLongPress, renderRowActions, selectedIds, subtle, text, toggleSelected]
  );

  const renderItem = useCallback(
    ({ item, index, section }: { item: DisplayTask; index: number; section: TaskSection }) => {
      const hasFooter = section.allData.length > section.data.length;
      return renderTaskCard(item, section.key, index, section.data.length, hasFooter);
    },
    [renderTaskCard]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: TaskSection }) => {
      const meta = sectionMeta(section.key, dark);
      return (
        <View
          style={[
            styles.sectionHeader,
            {
              backgroundColor: meta.sectionBg,
              borderColor: meta.sectionBorder,
            },
          ]}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={[styles.sectionIconWrap, { backgroundColor: `${meta.accent}22` }]}>
              <Ionicons name={meta.icon} size={16} color={meta.accent} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: text }]}>{section.title}</Text>
              <Text style={[styles.sectionSubtitle, { color: subtle }]}>{section.subtitle}</Text>
            </View>
          </View>
          <View style={[styles.sectionCountPill, { borderColor: meta.sectionBorder }]}>
            <Text style={[styles.sectionCount, { color: meta.accent }]}>{section.allData.length}</Text>
          </View>
        </View>
      );
    },
    [dark, subtle, text]
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: TaskSection }) => {
      if (section.allData.length <= section.data.length) return null;
      const meta = sectionMeta(section.key, dark);
      const remaining = section.allData.length - section.data.length;
      return (
        <TouchableOpacity
          style={[
            styles.moreBtn,
            {
              backgroundColor: meta.sectionBg,
              borderColor: meta.sectionBorder,
            },
          ]}
          onPress={() => setTaskListModal({ title: section.title, tasks: section.allData })}
          activeOpacity={0.85}
          accessibilityLabel={`View all ${section.allData.length} ${section.title.toLowerCase()} tasks`}
        >
          <View style={styles.moreBtnBody}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.moreBtnText, { color: meta.accent }]}>View all {section.allData.length} tasks</Text>
              <Text style={[styles.moreBtnSub, { color: subtle }]}>
                +{remaining} more in {section.title.toLowerCase()}
              </Text>
            </View>
            <View style={[styles.moreBtnIconWrap, { backgroundColor: `${meta.accent}22` }]}>
              <Ionicons name="chevron-forward" size={14} color={meta.accent} />
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [dark, subtle]
  );

  const listHeader = (
    <View style={styles.listHeaderWrap}>
      <View style={[styles.focusStrip, { paddingTop: headerHeight }]}>
        {([
          { key: "all", label: "Open", count: focusCounts.open },
          { key: "hard", label: "Hard", count: focusCounts.hard },
          { key: "medium", label: "Medium", count: focusCounts.medium },
          { key: "easy", label: "Easy", count: focusCounts.easy },
        ] as const).map((chip) => (
          <TouchableOpacity
            key={chip.key}
            onPress={() => setFocusFilter(chip.key)}
            style={[
              styles.focusChip,
              {
                borderColor: focusFilter === chip.key ? accent : border,
                backgroundColor: focusFilter === chip.key ? `${accent}22` : card,
              },
            ]}
          >
            <Text style={[styles.focusLabel, { color: text }]}>{chip.label}</Text>
            <Text style={[styles.focusCount, { color: subtle }]}>{chip.count}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.searchWrap, { borderColor: border, backgroundColor: card }]}> 
        <Ionicons name="search" size={18} color={subtle} />
        <TextInput
          placeholder="Search tasks..."
          placeholderTextColor={subtle}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: text }]}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={subtle} />
          </TouchableOpacity>
        ) : null}
      </View>

      {search.trim() && !batchMode ? (
        <View style={[styles.suggestionsWrap, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.suggestionsTitle, { color: subtle }]}>Likely tasks</Text>
          {searchSuggestions.length === 0 ? (
            <Text style={[styles.suggestionsEmpty, { color: subtle }]}>No close matches yet.</Text>
          ) : (
            searchSuggestions.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={[styles.suggestionRow, { borderColor: border }]}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: "/edit-task", params: { id: String(task.id) } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.suggestionTitle, { color: text }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={[styles.suggestionMeta, { color: subtle }]}>{formatDueLabel(task)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={subtle} />
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.sortRow}>
        {([
          { key: "due", label: "Due soonest" },
          { key: "hard", label: "Hardest first" },
          { key: "recent", label: "Recently added" },
        ] as const).map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => setSortBy(item.key)}
            style={[
              styles.sortChip,
              {
                borderColor: sortBy === item.key ? accent : border,
                backgroundColor: sortBy === item.key ? `${accent}22` : "transparent",
              },
            ]}
          >
            <Text style={[styles.sortText, { color: text }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.toolbarRow}>
        <TouchableOpacity
          style={[styles.completedButton, { borderColor: border }]}
          activeOpacity={0.85}
          onPress={() => router.push("/completed-tasks")}
        >
          <Text style={[styles.completedButtonText, { color: text }]}>View completed tasks</Text>
          <Ionicons name="chevron-forward" size={18} color={subtle} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.selectButton, { borderColor: border, backgroundColor: batchMode ? `${accent}22` : "transparent" }]}
          onPress={toggleBatchMode}
        >
          <Ionicons name={batchMode ? "close" : "checkmark-done-outline"} size={16} color={batchMode ? accent : text} />
          <Text style={[styles.selectButtonText, { color: batchMode ? accent : text }]}> 
            {batchMode ? "Cancel" : "Select"}
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: background }}>
      <View style={[styles.container, { backgroundColor: background }]}> 
        <BlurView
          intensity={40}
          tint={dark ? "dark" : "light"}
          style={[
            styles.blurHeader,
            { height: headerHeight, opacity: showHeaderBlur ? 1 : 0 },
          ]}
          pointerEvents="none"
        />

        {batchMode ? (
          <View style={[styles.batchBar, { borderColor: border, backgroundColor: card, marginTop: headerHeight }]}> 
            <Text style={[styles.batchTitle, { color: text }]}>{selectedCount} selected</Text>
            <View style={styles.batchActionsRow}>
              <TouchableOpacity
                style={[styles.batchActionBtn, { borderColor: border }]}
                onPress={handleBatchComplete}
                disabled={selectedCount === 0}
              >
                <Text style={[styles.batchActionText, { color: selectedCount === 0 ? subtle : "#1FAD4D" }]}>Complete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.batchActionBtn, { borderColor: border }]}
                onPress={handleBatchReschedule}
                disabled={selectedCount === 0}
              >
                <Text style={[styles.batchActionText, { color: selectedCount === 0 ? subtle : accent }]}>Reschedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.batchActionBtn, { borderColor: border }]}
                onPress={handleBatchDelete}
                disabled={selectedCount === 0}
              >
                <Text style={[styles.batchActionText, { color: selectedCount === 0 ? subtle : "#FF3B30" }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          stickySectionHeadersEnabled
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={[styles.emptyCard, { borderColor: border, backgroundColor: card }]}> 
              <Text style={[styles.emptyTitle, { color: text }]}>No matching tasks</Text>
              <Text style={[styles.emptySub, { color: subtle }]}>Try clearing filters or add a new task.</Text>
              <View style={styles.emptyActionsRow}>
                <TouchableOpacity
                  style={[styles.emptyBtn, { borderColor: border, backgroundColor: dark ? "#17304C" : "#EAF2FF" }]}
                  onPress={() => router.push("/add-assignment")}
                >
                  <Text style={[styles.emptyBtnText, { color: accent }]}>Add task</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.emptyBtn, { borderColor: border, backgroundColor: dark ? "#282D37" : "#F2F4F8" }]}
                  onPress={clearFilters}
                >
                  <Text style={[styles.emptyBtnText, { color: text }]}>Clear filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 120,
          }}
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
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
          removeClippedSubviews
        />

        <Modal
          visible={taskListModal !== null}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setTaskListModal(null)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
            <View style={[styles.modalHeader, { borderColor: border }]}>
              <Text style={[styles.modalTitle, { color: text }]}>{taskListModal?.title}</Text>
              <TouchableOpacity onPress={() => setTaskListModal(null)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {taskListModal?.tasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskCard, { borderColor: border, backgroundColor: card }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    setTaskListModal(null);
                    router.push({ pathname: "/edit-task", params: { id: String(task.id) } });
                  }}
                >
                  <View style={styles.taskHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, { color: text }]} numberOfLines={2}>
                        {task.title}
                      </Text>
                      <Text style={[styles.taskSub, { color: subtle }]}>{formatDueLabel(task)}</Text>
                    </View>
                    {renderRowActions(task)}
                  </View>
                  {task.notes ? (
                    <Text style={[styles.taskNotes, { color: subtle }]} numberOfLines={2}>
                      {getShortDescription(task.notes)}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add new task"
          onPress={() => router.push("/add-assignment")}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: "#007AFF",
              bottom: insets.bottom + 76,
              transform: [{ scale: pressed ? 0.95 : 1 }],
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blurHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  focusStrip: {
    paddingBottom: 10,
    flexDirection: "row",
    gap: 8,
    zIndex: 10,
    alignItems: "center",
  },
  focusChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  focusLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  focusCount: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  batchBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  batchTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  batchActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  batchActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  batchActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  listHeaderWrap: {
    gap: 10,
    paddingBottom: 8,
  },
  searchWrap: {
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  suggestionsWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  suggestionsEmpty: {
    fontSize: 13,
    paddingVertical: 6,
  },
  suggestionRow: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  suggestionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
  },
  sortChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  sortText: {
    fontSize: 12,
    fontWeight: "700",
  },
  toolbarRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  completedButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  completedButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  selectButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginTop: 8,
    marginBottom: 0,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  sectionCountPill: {
    borderWidth: 1,
    borderRadius: 999,
    minWidth: 34,
    height: 28,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "800",
  },
  moreBtn: {
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 0,
    marginBottom: 6,
    borderWidth: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  moreBtnBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  moreBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
  moreBtnSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  moreBtnIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  taskGroupRow: {
    padding: 12,
    gap: 8,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  taskGroupSingleNoFooter: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  taskGroupSingleWithFooter: {
    borderTopWidth: 1,
  },
  taskGroupFirst: {
    borderTopWidth: 1,
  },
  taskGroupMiddle: {
    borderTopWidth: 1,
  },
  taskGroupLastWithFooter: {
    borderTopWidth: 1,
  },
  taskGroupLast: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  taskCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  taskHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  taskSub: {
    fontSize: 13,
    marginTop: 2,
  },
  taskNotes: {
    fontSize: 13,
    lineHeight: 18,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  difficultyPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: "700",
  },
  taskActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  taskActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  emptySub: {
    fontSize: 14,
  },
  emptyActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  emptyBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalClose: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
