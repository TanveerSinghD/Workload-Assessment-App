import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColors } from "../../../hooks/use-theme-colors";
import { addTask, getTasks, updateManyTaskDueDates } from "@/lib/database";
import { updateAvailabilityWithFeedback } from "@/utils/availabilityFeedback";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Intent,
  LibraryType,
  getLibraries,
  isGreetingMessage,
  matchIntent,
  selectResponse,
  rememberTaskMessage,
} from "@/assistant_engine";
import { AssistantAction } from "@/assistant_actions/types";
import { runAssistantActions } from "@/assistant_actions/registry";
import { parseDateQuery, toISODateLocal, formatISODate } from "@/plannerAssistant/dateUtils";
import { detectPlannerIntent, isCancellation, isConfirmation } from "@/plannerAssistant/intents";
import {
  ConversationContext,
  ConversationTaskRef,
  createConversationContext,
  detectIntent as detectConversationIntent,
  extractDateRef,
  extractMoveTarget,
  isExplicitDateRef,
  resolveDateRef,
  updateContextForList,
  updateContextForMove,
} from "@/plannerAssistant/conversation";

type Task = {
  id: number;
  title: string;
  subject?: string | null;
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

type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
  tasks?: Pick<Task, "id" | "title" | "due_date" | "difficulty">[];
  actions?: AssistantAction[];
};

type AssistantReplyPayload = {
  text: string;
  tasks?: Pick<Task, "id" | "title" | "due_date" | "difficulty">[];
  actions?: AssistantAction[];
};

type PlannerSectionKey = "hero" | "overdue" | "gameplan" | "suggested" | "how";

const INITIAL_CHAT_MESSAGE: ChatMessage = {
  id: "welcome",
  from: "bot",
  text: "Hi! Ask me what to tackle first, how to schedule your day, or to break down a task.",
};

const ASSISTANT_DEBUG = __DEV__ && false; // toggle to true in dev to see matching logs
const ASSISTANT_LIBRARY_MAIN: LibraryType = "main";

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

function formatDueLabel(due: string | null | undefined) {
  if (!due) return "No due date";
  const dueDate = parseDueDate(due);
  const days = diffInDays(dueDate);
  if (days === null) return `Due ${due}`;
  if (days < 0) return `Overdue ${Math.abs(days)}d`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

function toClockLabel(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function roundToNextQuarterHour(base: Date) {
  const next = new Date(base);
  next.setSeconds(0, 0);
  const mins = next.getMinutes();
  const rounded = Math.ceil(mins / 15) * 15;
  if (rounded === 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(rounded, 0, 0);
  }
  return next;
}

const DIFFICULTY_RANK: Record<Task["difficulty"], number> = { hard: 0, medium: 1, easy: 2 };

function sortTasksForDisplay(list: Task[]) {
  return [...list].sort((a, b) => {
    const aDate = a.due_date ?? "";
    const bDate = b.due_date ?? "";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    const aRank = DIFFICULTY_RANK[a.difficulty] ?? 3;
    const bRank = DIFFICULTY_RANK[b.difficulty] ?? 3;
    return aRank - bRank;
  });
}

function getTasksDueOnDate(tasks: Task[], isoDate: string) {
  return sortTasksForDisplay(tasks.filter((t) => !t.completed && t.due_date === isoDate));
}

function getTasksDueInRange(tasks: Task[], startISO: string, endISO: string) {
  return sortTasksForDisplay(
    tasks.filter((t) => {
      if (t.completed) return false;
      const due = t.due_date;
      return due && due >= startISO && due <= endISO;
    })
  );
}

function summarizeBusiestDays(tasks: Task[], limit = 3) {
  const counts = new Map<string, number>();
  tasks.forEach((t) => {
    if (!t.due_date) return;
    counts.set(t.due_date, (counts.get(t.due_date) ?? 0) + 1);
  });
  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  if (!top.length) return "No tasks scheduled.";
  return top.map(([iso, count]) => `${formatISODate(iso, { withWeekday: true })} (${count})`).join(", ");
}

type RescheduleMove = { id: number; title: string; fromISO: string; toISO: string };
type PendingReschedulePlan = { sourceISO: string; moves: RescheduleMove[]; needsConfirmation: boolean };

function buildCandidateDays(sourceISO: string, nowISO: string) {
  const source = new Date(`${sourceISO}T00:00:00`);
  const today = new Date(`${nowISO}T00:00:00`);
  const days: string[] = [];
  if (source >= today) days.push(nowISO);
  for (let i = 1; i <= 6; i += 1) {
    const d = new Date(source);
    d.setDate(d.getDate() + i);
    const iso = toISODateLocal(d);
    if (iso >= nowISO) days.push(iso);
  }
  return Array.from(new Set(days));
}

function buildReschedulePlan(
  tasksToMove: Task[],
  sourceISO: string,
  openTasks: Task[],
  destinationISO?: string,
  nowISO?: string
): PendingReschedulePlan | null {
  if (!tasksToMove.length) return { sourceISO, moves: [], needsConfirmation: false };
  const candidateDays = destinationISO ? [destinationISO] : buildCandidateDays(sourceISO, nowISO ?? toISODateLocal(new Date()));
  const filtered = candidateDays.filter((d) => d !== sourceISO);
  if (!filtered.length) return null;

  const load = new Map<string, number>();
  filtered.forEach((day) => {
    const count = openTasks.filter((t) => !t.completed && t.due_date === day).length;
    load.set(day, count);
  });

  const sorted = [...tasksToMove].sort((a, b) => (DIFFICULTY_RANK[a.difficulty] ?? 3) - (DIFFICULTY_RANK[b.difficulty] ?? 3));
  const moves: RescheduleMove[] = [];

  sorted.forEach((task) => {
    const target = filtered.reduce((best, day) => {
      if (!best) return day;
      const current = load.get(day) ?? 0;
      const bestLoad = load.get(best) ?? 0;
      return current < bestLoad ? day : best;
    }, filtered[0]);
    load.set(target, (load.get(target) ?? 0) + 1);
    moves.push({ id: task.id, title: task.title, fromISO: sourceISO, toISO: target });
  });

  return { sourceISO, moves, needsConfirmation: moves.length > 3 };
}

function describePlan(plan: PendingReschedulePlan) {
  const fromLabel = formatISODate(plan.sourceISO, { withWeekday: true });
  const destSet = Array.from(new Set(plan.moves.map((m) => m.toISO)));
  const destLabel = destSet.map((d) => formatISODate(d, { withWeekday: true })).join(" · ");
  const detail = plan.moves
    .slice(0, 6)
    .map((m) => `• ${m.title} → ${formatISODate(m.toISO, { withWeekday: true })}`)
    .join("\n");
  return { fromLabel, destLabel, detail };
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

function isMathExpression(text: string) {
  const cleaned = text.replace(/\s+/g, "");
  return /^[\d.+\-*/()%^]+$/.test(cleaned) && /\d/.test(cleaned);
}

function tryEvalMath(text: string): number | null {
  if (!isMathExpression(text)) return null;
  const normalized = text.replace(/\^/g, "**");
  try {
    const result = Function(`"use strict"; return (${normalized});`)();
    if (typeof result === "number" && Number.isFinite(result)) return result;
    return null;
  } catch {
    return null;
  }
}

const STOPWORDS = new Set([
  "show",
  "me",
  "all",
  "my",
  "the",
  "tasks",
  "task",
  "please",
  "and",
  "of",
  "to",
  "a",
  "for",
  "list",
  "display",
  "do",
  "tell",
  "about",
  "next",
  "due",
]);

function extractKeywords(message: string) {
  return message
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function scoreTaskMatch(keywords: string[], task: Task) {
  const haystack = `${task.title} ${task.notes ?? ""} ${task.subject ?? ""}`.toLowerCase();
  if (!keywords.length) return 0;
  let hits = 0;
  keywords.forEach((kw) => {
    if (haystack.includes(kw)) hits += 1;
  });
  return hits / keywords.length;
}

function findRelatedTasks(message: string, tasks: Task[]) {
  const keywords = extractKeywords(message);
  const scored = tasks
    .map((t) => ({ task: t, score: scoreTaskMatch(keywords, t) }))
    .filter((t) => t.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  if (scored.length) return scored.map((s) => s.task);

  // If user mentioned "tasks" but no keyword hits, fall back to all open tasks (limited)
  if (message.toLowerCase().includes("task")) {
    return tasks.slice(0, 8);
  }
  return null;
}

function detectStatsRequest(message: string) {
  const m = message.toLowerCase();
  const rangeMatch = m.match(/(last|past)\s+(\d+)\s*(day|week|month|days|weeks|months)/);
  const completedHit = /(how many|count).*(done|completed|finished)/.test(m);
  if (!rangeMatch && !/today|this week|this month/.test(m)) return null;
  if (!completedHit && !/done|completed|finished|finished tasks/.test(m)) return null;

  let days = 7;
  if (rangeMatch) {
    const n = Number(rangeMatch[2]);
    const unit = rangeMatch[3];
    if (unit.startsWith("day")) days = n;
    else if (unit.startsWith("week")) days = n * 7;
    else if (unit.startsWith("month")) days = n * 30;
  } else if (/today/.test(m)) {
    days = 1;
  } else if (/this week/.test(m)) {
    days = 7;
  } else if (/this month/.test(m)) {
    days = 30;
  }
  return days;
}

function completedInRange(tasks: Task[], days: number) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  const matches = tasks.filter((t) => {
    if (!t.completed) return false;
    const d = parseDueDate(t.due_date ?? null);
    if (!d) return true; // if no due date but completed, include
    return d >= cutoff && d <= now;
  });
  return matches;
}

function buildContextSnapshot(tasks: Task[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let open = 0;
  let overdue = 0;
  let dueToday = 0;
  let dueWeek = 0;
  let completed = 0;

  tasks.forEach((t) => {
    if (t.completed) {
      completed += 1;
      return;
    }
    open += 1;
    const due = parseDueDate(t.due_date ?? null);
    if (!due) return;
    const diff = diffInDays(due);
    if (diff === null) return;
    if (diff < 0) overdue += 1;
    else if (diff === 0) dueToday += 1;
    else if (diff <= 7) dueWeek += 1;
  });

  return `Status: ${open} open (${overdue} overdue, ${dueToday} today, ${dueWeek} this week). ${completed} completed so far.`;
}

function isOverviewRequest(message: string) {
  const lower = message.toLowerCase();
  return /(overview|status|what's going on|how am i doing|summary|context)/.test(lower);
}

function summarizeTasks(timeframe: "today" | "week" | "overdue", tasks: Task[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const filtered = tasks.filter((t) => {
    const due = parseDueDate(t.due_date ?? null);
    if (!due) return false;
    const diff = diffInDays(due);
    if (diff === null) return false;
    if (timeframe === "today") return diff === 0;
    if (timeframe === "week") return diff >= 0 && diff <= 7;
    if (timeframe === "overdue") return diff < 0;
    return false;
  });
  const summary =
    timeframe === "today"
      ? "Today’s tasks"
      : timeframe === "week"
      ? "This week’s tasks"
      : "Overdue tasks";
  return {
    title: summary,
    items: filtered.slice(0, 8),
  };
}

function needsSummary(message: string) {
  const lower = message.toLowerCase();
  if (/today/.test(lower)) return "today";
  if (/week|next 7/.test(lower)) return "week";
  if (/overdue|late/.test(lower)) return "overdue";
  return null;
}

function detectTone(message: string) {
  const lower = message.toLowerCase();
  if (/(stressed|overwhelmed|struggling|tired|stuck)/.test(lower)) return "coach";
  if (/(urgent|asap|quick|now)/.test(lower)) return "directive";
  return "neutral";
}

function mapTasksForChat(tasks: Task[]) {
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date ?? undefined,
    difficulty: t.difficulty,
  }));
}

function mapTasksForConversationContext(tasks: Task[]): ConversationTaskRef[] {
  return tasks.map((task) => ({
    id: String(task.id),
    title: task.title,
  }));
}

function sanitizeIntentPrefix(text: string) {
  return text.replace(/^intent intent_\d{3,6}:\s*/i, "").trim();
}

function extractDestinationDate(text: string, now: Date, timezone?: string) {
  const lower = text.toLowerCase();
  const toIndex = lower.indexOf(" to ");
  if (toIndex === -1) return null;
  const candidate = text.slice(toIndex + 4).trim();
  if (!candidate) return null;
  const parsed = parseDateQuery(candidate, now, timezone);
  if (parsed && parsed.type === "day") return parsed.startISO;
  return null;
}

function parseCreateTaskRequest(message: string) {
  const lower = message.toLowerCase();
  if (!/(add|create).*(task)/.test(lower)) return null;
  const difficultyMatch = lower.match(/(easy|medium|hard)/);
  const difficulty = (difficultyMatch?.[1] as "easy" | "medium" | "hard") ?? "medium";
  let due: string | null = null;
  if (/tomorrow/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    due = d.toISOString().split("T")[0];
  } else {
    const dateMatch = lower.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) due = dateMatch[1];
  }
  let title = message;
  const afterColon = message.split(":")[1];
  if (afterColon) title = afterColon.trim();
  const afterTask = message.split(/task/i)[1];
  if (afterTask && afterTask.trim().length > 3) title = afterTask.trim();
  title = title.replace(/due .*/i, "").trim();
  if (!title) title = "New task";
  return { title, due_date: due, difficulty };
}

function wantsOverdueNavigation(message: string) {
  const lower = message.toLowerCase();
  return /overdue/.test(lower) && /(show|open|see)/.test(lower);
}

function wantsOldestOverdueComplete(message: string) {
  const lower = message.toLowerCase();
  return /oldest.*overdue/.test(lower) && /(complete|mark)/.test(lower);
}

function wantsPlannerRefresh(message: string) {
  const lower = message.toLowerCase();
  return /planner/.test(lower) && /(refresh|update|reload)/.test(lower);
}

function wantsAlertsOff(message: string) {
  const lower = message.toLowerCase();
  return /(turn off|disable|stop).*(alert|notification)/.test(lower);
}

function wantsQuickActionCompleted(message: string) {
  const lower = message.toLowerCase();
  return /(quick action).*(completed)/.test(lower) || /(set tasks quick action to completed)/.test(lower);
}


export default function PlannerScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const colors = useThemeColors();
  const listRef = useRef<FlatList<PlannerSectionKey>>(null);
  useScrollToTop(listRef);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const intentsRef = useRef<Intent[] | null>(null);
  const greetingsRef = useRef<Intent[] | null>(null);
  const pendingPlanRef = useRef<PendingReschedulePlan | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showHeaderBlur, setShowHeaderBlur] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatAnim = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get("window").height;
  const chatScrollRef = useRef<ScrollView>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([INITIAL_CHAT_MESSAGE]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [taskListModal, setTaskListModal] = useState<{ title: string; tasks: PlannedTask[] } | null>(null);
  const [conversationContext, setConversationContext] = useState<ConversationContext>(() =>
    createConversationContext(new Date())
  );
  const conversationContextRef = useRef<ConversationContext>(conversationContext);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showSuggestedOrder, setShowSuggestedOrder] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Same global colours as the rest of the app
  const background = colors.background;
  const card = colors.surface;
  const border = colors.borderSubtle;
  const text = colors.textPrimary;
  const subtle = colors.textMuted;
  const chatSheetBackground = dark ? "#0B1424" : colors.surface;
  const overlayColor = keyboardVisible ? chatSheetBackground : colors.overlay;

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

  const ensureLibraries = useCallback(async () => {
    if (intentsRef.current && greetingsRef.current) {
      return { main: intentsRef.current, greetings: greetingsRef.current };
    }
    const libs = await getLibraries();
    intentsRef.current = libs.main;
    greetingsRef.current = libs.greetings;
    return libs;
  }, []);

  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const openTaskById = useMemo(() => {
    const map = new Map<number, Task>();
    openTasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [openTasks]);

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

  const scheduleTimeline = useMemo(() => {
    const startAt = roundToNextQuarterHour(new Date());
    let cursor = startAt;
    return agentPlan.schedule.map((item) => {
      const start = new Date(cursor);
      const end = new Date(start.getTime() + item.minutes * 60 * 1000);
      cursor = end;
      return {
        ...item,
        startLabel: toClockLabel(start),
        endLabel: toClockLabel(end),
      };
    });
  }, [agentPlan.schedule]);

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

  const openAddTask = useCallback(() => {
    router.push("/add-assignment");
  }, []);

  const handleStartNextBlock = useCallback(() => {
    const next = scheduleTimeline[0];
    if (!next) return;
    handleOpenTask(next.id);
  }, [handleOpenTask, scheduleTimeline]);

  const renderTaskActions = useCallback(
    (task: Task | undefined) => {
      if (!task) return null;
      return (
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[
              styles.rowActionBtn,
              { borderColor: border, backgroundColor: dark ? "#17304C" : "#EAF2FF" },
            ]}
            accessibilityLabel={`Mark ${task.title} complete`}
            onPress={(event) => {
              event.stopPropagation();
              handleToggleComplete(task);
            }}
          >
            <Ionicons name="checkmark" size={15} color={dark ? "#8FC0FF" : "#0A84FF"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.rowActionBtn,
              { borderColor: border, backgroundColor: dark ? "#282D37" : "#F2F4F8" },
            ]}
            accessibilityLabel={`More actions for ${task.title}`}
            onPress={(event) => {
              event.stopPropagation();
              handleQuickActions(task);
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={15} color={subtle} />
          </TouchableOpacity>
        </View>
      );
    },
    [border, dark, handleQuickActions, handleToggleComplete, subtle]
  );

  const plannerSections = useMemo(() => {
    const sections: PlannerSectionKey[] = ["hero"];
    if (overdueTasks.length > 0) sections.push("overdue");
    sections.push("gameplan");
    if (agentPlan.sections.length > 0) sections.push("suggested");
    sections.push("how");
    return sections;
  }, [agentPlan.sections.length, overdueTasks.length]);

  const headerHeight = insets.top + 8;
  const contentTopPadding = headerHeight + 8;

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const shouldShow = y > 8;
    setShowHeaderBlur((prev) => (prev === shouldShow ? prev : shouldShow));
  }, []);

  const openChat = useCallback(() => {
    setChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    Animated.timing(chatAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setChatOpen(false));
  }, [chatAnim]);

  useEffect(() => {
    if (!chatOpen) return;
    chatAnim.setValue(1);
    Animated.timing(chatAnim, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [chatAnim, chatOpen]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollToEnd({ animated: true });
  }, [chatMessages]);

  useEffect(() => {
    conversationContextRef.current = conversationContext;
  }, [conversationContext]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const parent = navigation.getParent?.();
    if (!parent) return;
    parent.setOptions({ tabBarStyle: chatOpen ? { display: "none" } : undefined });
    return () => {
      parent.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation, chatOpen]);

  const interpretTaskQuery = useCallback(
    (input: string): AssistantReplyPayload | null => {
      const clean = input.toLowerCase();
      const wantDifficulty =
        /hard/.test(clean) ? "hard" : /medium/.test(clean) ? "medium" : /easy/.test(clean) ? "easy" : null;
      const wantOverdue = /overdue|late|past due/.test(clean);
      const wantToday = /today|tonight/.test(clean);
      const wantWeek = /this week|next 7|coming week/.test(clean);
      const wantNextWeek = /next week/.test(clean);

      if (!(wantDifficulty || wantOverdue || wantToday || wantWeek || wantNextWeek)) return null;

      const filtered = openTasks.filter((task) => {
        if (wantDifficulty && task.difficulty !== wantDifficulty) return false;

        const due = parseDueDate(task.due_date ?? null);
        const diff = diffInDays(due);
        if (wantOverdue) return diff !== null && diff < 0;
        if (wantToday) return diff === 0;
        if (wantWeek) return diff !== null && diff >= 0 && diff <= 7;
        if (wantNextWeek) return diff !== null && diff >= 7 && diff <= 14;
        return true;
      });

      const labelParts = [];
      if (wantDifficulty) labelParts.push(`${wantDifficulty} tasks`);
      if (wantOverdue) labelParts.push("overdue");
      else if (wantToday) labelParts.push("due today");
      else if (wantWeek) labelParts.push("due this week");
      else if (wantNextWeek) labelParts.push("due next week");

      const header = labelParts.length ? labelParts.join(", ") : "Matching tasks";
      if (filtered.length === 0) return { text: `${header}: none found.` };

      const summary = `${header}: tap to open.`;
      return {
        text: summary,
        tasks: filtered.slice(0, 12).map((t) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date ?? undefined,
          difficulty: t.difficulty,
        })),
      };
    },
    [openTasks]
  );

  const generateAssistantReply = useCallback(
    async (input: string): Promise<AssistantReplyPayload> => {
      const actions: AssistantAction[] = [];
      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const nowISO = toISODateLocal(now);
      const lowerInput = input.trim().toLowerCase();
      let context: ConversationContext = {
        ...conversationContextRef.current,
        nowISO,
      };
      const commitContext = (next: ConversationContext) => {
        context = next;
        conversationContextRef.current = next;
        setConversationContext(next);
      };

      if (pendingPlanRef.current) {
        if (isConfirmation(lowerInput)) {
          const plan = pendingPlanRef.current;
          pendingPlanRef.current = null;
          await updateManyTaskDueDates(plan.moves.map((m) => ({ id: m.id, due_date: m.toISO })));
          await loadTasks(true);
          const { fromLabel, destLabel, detail } = describePlan(plan);
          return {
            text: `Moved ${plan.moves.length} task${plan.moves.length === 1 ? "" : "s"} off ${fromLabel} to ${destLabel}.${detail ? `\n${detail}` : ""}`,
            actions,
          };
        }
        if (isCancellation(lowerInput)) {
          pendingPlanRef.current = null;
          return { text: "Cancelled the pending reschedule.", actions };
        }
      }

      const mathResult = tryEvalMath(input);
      if (mathResult !== null) {
        return { text: `${input.replace(/\s+/g, " ")} = ${mathResult}`, actions };
      }

      const conversationalIntent = detectConversationIntent(input);
      const dateRef = extractDateRef(input);
      let resolvedDateISO = resolveDateRef(dateRef, context, now);
      const explicitMentionISO = isExplicitDateRef(dateRef) ? resolvedDateISO : null;

      if (conversationalIntent === "LIST_TASKS") {
        if (!resolvedDateISO) {
          const fallbackDate = parseDateQuery(input, now, timezone);
          if (fallbackDate?.type === "day") {
            resolvedDateISO = fallbackDate.startISO;
          } else if (fallbackDate?.type === "range") {
            const rangeTasks = getTasksDueInRange(openTasks, fallbackDate.startISO, fallbackDate.endISO);
            const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
              new Date(`${fallbackDate.startISO}T00:00:00`)
            );
            commitContext(
              updateContextForList(
                context,
                fallbackDate.startISO,
                mapTasksForConversationContext(rangeTasks.slice(0, 20)),
                fallbackDate.startISO
              )
            );
            if (!rangeTasks.length) {
              return { text: `${monthLabel}: nothing scheduled.`, actions };
            }
            const busy = summarizeBusiestDays(rangeTasks);
            return {
              text: `${monthLabel}: ${rangeTasks.length} task${rangeTasks.length === 1 ? "" : "s"}. Busiest days: ${busy}.`,
              tasks: mapTasksForChat(rangeTasks.slice(0, 20)),
              actions,
            };
          }
        }

        if (!resolvedDateISO) {
          return {
            text: "Tell me the date to check (for example: 8th, 8th of March, March 8, or next Tuesday).",
            actions,
          };
        }

        const list = getTasksDueOnDate(openTasks, resolvedDateISO);
        commitContext(
          updateContextForList(
            context,
            resolvedDateISO,
            mapTasksForConversationContext(list),
            explicitMentionISO ?? resolvedDateISO
          )
        );

        if (!list.length) {
          return { text: `No tasks on ${resolvedDateISO}.`, actions };
        }
        return {
          text: `${list.length} task${list.length === 1 ? "" : "s"} on ${resolvedDateISO}.`,
          tasks: mapTasksForChat(list),
          actions,
        };
      }

      if (conversationalIntent === "MOVE_TASK") {
        if (!resolvedDateISO) {
          const toIndex = lowerInput.lastIndexOf(" to ");
          if (toIndex !== -1) {
            const suffix = input.slice(toIndex + 4).trim();
            const suffixDateRef = extractDateRef(suffix);
            resolvedDateISO = resolveDateRef(suffixDateRef, context, now);
          }
        }
        if (!resolvedDateISO) {
          resolvedDateISO = extractDestinationDate(input, now, timezone);
        }
        if (!resolvedDateISO) {
          return {
            text: "Tell me the date to move to (for example: tomorrow, the 8th, or next Tuesday).",
            actions,
          };
        }

        const moveTarget = extractMoveTarget(
          input,
          context,
          openTasks.map((task) => ({ id: String(task.id), title: task.title }))
        );

        if (moveTarget.kind === "clarify") {
          const options = moveTarget.options
            .map((task, index) => `${index + 1}. ${task.title}`)
            .join(" | ");
          return {
            text: `Which task should I move? ${options}`,
            actions,
          };
        }

        if (moveTarget.kind === "none") {
          if (moveTarget.reason === "not_found") {
            return { text: "I couldn't find that task title. Try quoting the exact title.", actions };
          }
          return {
            text: "Tell me which task to move (quoted title, first/second/third/last, it, or them all).",
            actions,
          };
        }

        const idSet = new Set(moveTarget.taskIds);
        const tasksToMove = openTasks.filter((task) => idSet.has(String(task.id)));
        if (!tasksToMove.length) {
          return { text: "I couldn't find that task in your current open list.", actions };
        }

        await updateManyTaskDueDates(tasksToMove.map((task) => ({ id: task.id, due_date: resolvedDateISO })));
        await loadTasks(true);

        commitContext(
          updateContextForMove(
            context,
            resolvedDateISO,
            mapTasksForConversationContext(tasksToMove),
            explicitMentionISO ?? resolvedDateISO
          )
        );

        if (tasksToMove.length === 1) {
          return { text: `Moved '${tasksToMove[0].title}' to ${resolvedDateISO}.`, actions };
        }
        return {
          text: `Moved ${tasksToMove.length} tasks to ${resolvedDateISO}.`,
          actions,
        };
      }

      const plannerIntent = detectPlannerIntent(lowerInput);
      const dateQuery = parseDateQuery(input, now, timezone);

      if (plannerIntent === "SHOW_TASKS") {
        if (!dateQuery) {
          return { text: "Tell me which day or month to show (e.g. “tasks tomorrow”, “24 April”, or “April next year”).", actions };
        }
        if (dateQuery.confidence === "low" && dateQuery.type === "day") {
          const assumed = formatISODate(dateQuery.startISO, { withWeekday: true });
          return { text: `I’m reading that as ${assumed} (DD/MM). If that’s wrong, tell me the month name.`, actions };
        }

        if (dateQuery.type === "day") {
          const list = getTasksDueOnDate(openTasks, dateQuery.startISO);
          const label = formatISODate(dateQuery.startISO, { withWeekday: true });
          if (!list.length) return { text: `You’re clear on ${label} 🎉`, actions };
          return { text: `${list.length} task${list.length === 1 ? "" : "s"} on ${label}.`, tasks: mapTasksForChat(list), actions };
        }

        const rangeTasks = getTasksDueInRange(openTasks, dateQuery.startISO, dateQuery.endISO);
        const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
          new Date(`${dateQuery.startISO}T00:00:00`)
        );
        if (!rangeTasks.length) {
          return { text: `${monthLabel}: nothing scheduled.`, actions };
        }
        const busy = summarizeBusiestDays(rangeTasks);
        return {
          text: `${monthLabel}: ${rangeTasks.length} task${rangeTasks.length === 1 ? "" : "s"}. Busiest days: ${busy}.`,
          tasks: mapTasksForChat(rangeTasks.slice(0, 20)),
          actions,
        };
      }

      if (plannerIntent === "FREE_UP_DAY") {
        if (!dateQuery || dateQuery.type !== "day") {
          return { text: "Tell me which day to clear (e.g. “free up my day tomorrow”).", actions };
        }
        const targetISO = dateQuery.startISO;
        const targetLabel = formatISODate(targetISO, { withWeekday: true });
        const tasksOnDay = getTasksDueOnDate(openTasks, targetISO);
        if (!tasksOnDay.length) {
          return { text: `${targetLabel} is already free.`, actions };
        }
        const destinationISO = extractDestinationDate(input, now, timezone) ?? undefined;
        const plan = buildReschedulePlan(tasksOnDay, targetISO, openTasks, destinationISO, nowISO);
        if (!plan) {
          return { text: "I couldn't find a safe day to move these to. Try giving a destination date.", actions };
        }

        const { fromLabel, destLabel, detail } = describePlan(plan);
        if (plan.needsConfirmation) {
          pendingPlanRef.current = plan;
          return { text: `I can move ${plan.moves.length} task${plan.moves.length === 1 ? "" : "s"} from ${fromLabel} to ${destLabel}. Confirm?${detail ? `\n${detail}` : ""}`, actions };
        }

        await updateManyTaskDueDates(plan.moves.map((m) => ({ id: m.id, due_date: m.toISO })));
        await loadTasks(true);
        return { text: `Moved ${plan.moves.length} task${plan.moves.length === 1 ? "" : "s"} off ${fromLabel} to ${destLabel}.${detail ? `\n${detail}` : ""}`, actions };
      }

      const createRequest = parseCreateTaskRequest(input);
      if (createRequest) {
        actions.push({
          type: "CREATE_TASK",
          payload: {
            title: createRequest.title,
            description: createRequest.title,
            difficulty: createRequest.difficulty,
            due_date: createRequest.due_date ?? null,
          },
        });
        actions.push({ type: "NAVIGATE", payload: { route: "/(tabs)/tasks/tasks" } });
        actions.push({ type: "SET_TASK_FILTER", payload: { filter: "all" } });
        return {
          text: `Added “${createRequest.title}” (${createRequest.difficulty})${createRequest.due_date ? ` due ${createRequest.due_date}` : ""}.`,
          actions,
        };
      }

      const statsRange = detectStatsRequest(input);
      if (statsRange) {
        const completed = completedInRange(tasks, statsRange);
        const total = completed.length;
        if (total === 0) {
          return { text: `No completed tasks in the last ${statsRange} day(s). Want to review open ones instead?`, actions };
        }
        return {
          text: `You completed ${total} task${total === 1 ? "" : "s"} in the last ${statsRange} day(s). Tap any to view.`,
          tasks: completed.slice(0, 8).map((t) => ({
            id: t.id,
            title: t.title,
            due_date: t.due_date ?? undefined,
            difficulty: t.difficulty,
          })),
          actions,
        };
      }

      if (isOverviewRequest(input)) {
        const snapshot = buildContextSnapshot(tasks);
        const top = openTasks.slice(0, 6).map((t) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date ?? undefined,
          difficulty: t.difficulty,
        }));
        return {
          text: `${snapshot} Here are a few open items:`,
          tasks: top,
          actions,
        };
      }

      const taskReply = interpretTaskQuery(input);
      if (taskReply) return taskReply;

      // Task name/entity matching
      const related = findRelatedTasks(input, openTasks);
      if (related && related.length) {
        related.forEach((t) => rememberTaskMessage(t.id, ASSISTANT_LIBRARY_MAIN, input));
        return {
          text: "Here are the tasks that match what you mentioned. Tap to open any of them.",
          tasks: related.map((t) => ({
            id: t.id,
            title: t.title,
            due_date: t.due_date ?? undefined,
            difficulty: t.difficulty,
          })),
          actions,
        };
      }

      const summaryRange = needsSummary(input);
      if (summaryRange) {
        const { items, title } = summarizeTasks(summaryRange as "today" | "week" | "overdue", openTasks);
        if (items.length) {
          return {
            text: `${title}: tap to open or long-press to quick edit.`,
            tasks: items.map((t) => ({
              id: t.id,
              title: t.title,
              due_date: t.due_date ?? undefined,
              difficulty: t.difficulty,
            })),
            actions,
          };
        }
      }

      if (wantsOverdueNavigation(input)) {
        actions.push({ type: "SET_TASK_FILTER", payload: { filter: "overdue" } });
        actions.push({ type: "NAVIGATE", payload: { route: "/(tabs)/tasks/tasks", params: { filter: "overdue" } } });
        return { text: "Opening overdue tasks.", actions };
      }

      if (wantsOldestOverdueComplete(input)) {
        const oldest = openTasks
          .map((t) => ({ t, due: parseDueDate(t.due_date ?? null) }))
          .filter(({ due }) => due && diffInDays(due) !== null && diffInDays(due)! < 0)
          .sort((a, b) => a.due!.getTime() - b.due!.getTime())[0];
        if (!oldest) return { text: "No overdue tasks to complete.", actions };
        actions.push({ type: "COMPLETE_TASK", payload: { id: oldest.t.id, value: true } });
        return { text: `Marked "${oldest.t.title}" as complete.`, actions };
      }

      if (wantsPlannerRefresh(input)) {
        actions.push({ type: "NAVIGATE", payload: { route: "/(tabs)/planner/planner" } });
        actions.push({ type: "REFRESH_PLAN" });
        return { text: "Opening Planner and refreshing your plan.", actions };
      }

      if (wantsAlertsOff(input)) {
        actions.push({ type: "SET_SETTING", payload: { key: "notificationsEnabled", value: false } });
        return { text: "Turning alerts off.", actions };
      }

      if (wantsQuickActionCompleted(input)) {
        actions.push({ type: "UPDATE_NAV_QUICK_ACTION", payload: { navId: "tasks", actionId: "completed" } });
        return { text: "Updated Tasks quick action to 'Completed tasks'.", actions };
      }

      if (isOverviewRequest(input)) {
        const snapshot = buildContextSnapshot(tasks);
        const top = openTasks.slice(0, 6).map((t) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date ?? undefined,
          difficulty: t.difficulty,
        }));
        return { text: `${snapshot} Here are a few open items:`, tasks: top, actions };
      }

      const tone = detectTone(input);

      const planKeywords = /plan|schedule|today|start|tackle|do first|what now|where to start/i.test(input);
      if (planKeywords) {
        const overdue = openTasks
          .map((t) => ({ ...t, days: diffInDays(parseDueDate(t.due_date ?? null)) }))
          .filter((t) => t.days !== null && t.days < 0)
          .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
        const dueToday = openTasks
          .map((t) => ({ ...t, days: diffInDays(parseDueDate(t.due_date ?? null)) }))
          .filter((t) => t.days === 0);
        const soon = openTasks
          .map((t) => ({ ...t, days: diffInDays(parseDueDate(t.due_date ?? null)) }))
          .filter((t) => t.days !== null && t.days > 0)
          .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

        const list: Task[] = [];
        if (overdue.length) list.push(...overdue.slice(0, 2));
        if (dueToday.length) list.push(...dueToday.slice(0, 2));
        if (soon.length) list.push(...soon.slice(0, 2));

        const headline =
          overdue.length > 0
            ? "Fix overdue first, then today’s highest effort, then a quick win."
            : dueToday.length > 0
            ? "Tackle today’s deadlines, then one deep focus item, then a quick win."
            : "No deadlines today—schedule one deep block and one quick win.";

        return {
          text: `${headline} Tap a task to open it.`,
          tasks: list.map((t) => ({
            id: t.id,
            title: t.title,
            due_date: t.due_date ?? undefined,
            difficulty: t.difficulty,
          })),
          actions,
        };
      }

      const libs = await ensureLibraries();
      const isGreeting = isGreetingMessage(input);
      const libraryType = isGreeting ? "greet" : "main";
      const pool = isGreeting ? libs.greetings : libs.main;
      const match = matchIntent(input, pool, 0.22);
      const selection = await selectResponse(match.top?.intent ?? null, {
        userMessage: input,
        library: libraryType,
        preferredGroup: tone === "coach" ? "coach" : undefined,
      });

      if (ASSISTANT_DEBUG) {
        console.log("[assistant_engine] matched", {
          library: libraryType,
          intent: match.top?.intent?.id,
          score: match.top?.score,
          group: selection.group,
          index: selection.index,
        });
      }

      const safeText = sanitizeIntentPrefix(selection.text);
      return { text: safeText || "I’m not sure how to answer that. Want to review today’s tasks?", actions };
    },
    [ensureLibraries, interpretTaskQuery, loadTasks, openTasks, tasks]
  );

  const handleSendMessage = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = { id: `u-${Date.now()}`, from: "user", text: trimmed };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    try {
      const botPayload = await generateAssistantReply(trimmed);
      const botMessage: ChatMessage = {
        id: `b-${Date.now()}`,
        from: "bot",
        text: typeof botPayload === "string" ? botPayload : botPayload.text,
        tasks: typeof botPayload === "string" ? undefined : botPayload.tasks,
        actions: typeof botPayload === "string" ? undefined : botPayload.actions,
      };
      setChatMessages((prev) => [...prev, botMessage]);

      if (botMessage.actions?.length) {
        await runAssistantActions(botMessage.actions, {
          onTasksChanged: async () => {
            await loadTasks(true);
          },
          onRefreshPlan: async () => {
            await loadTasks(true);
          },
          debug: ASSISTANT_DEBUG,
        });
      }
    } catch (error) {
      console.error("[assistant_engine] Failed to respond:", error);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          from: "bot",
          text: "Something went wrong generating a reply. Try again in a moment.",
        },
      ]);
    }
  }, [chatInput, generateAssistantReply, loadTasks]);

  const handleClearChat = useCallback(() => {
    setChatMessages([INITIAL_CHAT_MESSAGE]);
    setChatInput("");
    const resetContext = createConversationContext(new Date());
    conversationContextRef.current = resetContext;
    setConversationContext(resetContext);
  }, []);

  const renderPlannerSection = useCallback(
    ({ item }: { item: PlannerSectionKey }) => {
      if (item === "hero") {
        return (
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

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={openChat}
                  activeOpacity={0.9}
                  style={[
                    styles.chatPrompt,
                    { backgroundColor: dark ? "#10284D" : "#DCE9FF", borderColor: dark ? "#1C3F7A" : "#B7D0FF" },
                  ]}
                  accessibilityLabel="Open planning chat helper"
                >
                  <Ionicons name="chatbubbles-outline" size={18} color={dark ? "#F0F6FF" : "#0A84FF"} />
                  <Text style={[styles.chatPromptText, { color: dark ? "#F0F6FF" : "#0A84FF" }]}>Ask planner</Text>
                </TouchableOpacity>

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
        );
      }

      if (item === "overdue") {
        return (
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
              {overdueTasks.slice(0, 3).map((task) => (
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
                >
                  <View style={[styles.rankDot, { backgroundColor: "#FF453A" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, { color: text }]}>{task.title}</Text>
                    <Text style={[styles.taskReason, { color: subtle }]}>
                      {task.reason || `Overdue by ${Math.abs(task.daysUntil ?? 0)}d`}
                    </Text>
                  </View>
                  <Text style={[styles.badge, { color: text }]}>{formatDueLabel(task.due_date)}</Text>
                  {renderTaskActions(task)}
                </TouchableOpacity>
              ))}
              {overdueTasks.length > 3 && (
                <TouchableOpacity
                  style={styles.showAllBtn}
                  activeOpacity={0.8}
                  onPress={() => setTaskListModal({ title: "Overdue tasks", tasks: overdueTasks })}
                >
                  <Text style={styles.showAllText}>Show all {overdueTasks.length} overdue →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      }

      if (item === "gameplan") {
        return (
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
              <View style={styles.stateBlock}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={[styles.stateActionBtn, { borderColor: border, backgroundColor: dark ? "#17304C" : "#EAF2FF" }]}
                  onPress={() => loadTasks(true)}
                >
                  <Text style={styles.stateActionText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : agentPlan.prioritized.length === 0 ? (
              <View style={styles.stateBlock}>
                <Text style={[styles.emptyState, { color: subtle }]}>No tasks yet. Add one to generate your plan.</Text>
                <View style={styles.stateActionsRow}>
                  <TouchableOpacity
                    style={[styles.stateActionBtn, { borderColor: border, backgroundColor: dark ? "#17304C" : "#EAF2FF" }]}
                    onPress={openAddTask}
                  >
                    <Text style={styles.stateActionText}>Add first task</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stateActionBtn, { borderColor: border, backgroundColor: dark ? "#282D37" : "#F2F4F8" }]}
                    onPress={() => loadTasks(true)}
                  >
                    <Text style={[styles.stateActionText, { color: subtle }]}>Refresh</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <Text style={[styles.summary, { color: text }]}>{agentPlan.summary}</Text>

                <View style={[styles.scheduleCard, { borderColor: border }]}>
                  <View style={styles.scheduleHeader}>
                    <Text style={[styles.sectionTitle, { color: text }]}>Schedule for today</Text>
                    <Text style={[styles.statHint, { color: subtle }]}>{agentPlan.totalMinutes} min planned</Text>
                  </View>
                  {scheduleTimeline.length > 0 ? (
                    <TouchableOpacity
                      style={[
                        styles.startBlockBtn,
                        { borderColor: border, backgroundColor: dark ? "#17304C" : "#EAF2FF" },
                      ]}
                      onPress={handleStartNextBlock}
                    >
                      <Ionicons name="play" size={14} color={dark ? "#8FC0FF" : "#0A84FF"} />
                      <Text style={styles.startBlockText}>Start next block</Text>
                    </TouchableOpacity>
                  ) : null}

                  {scheduleTimeline.length === 0 ? (
                    <Text style={[styles.statHint, { color: subtle }]}>Add tasks to build a schedule.</Text>
                  ) : (
                    scheduleTimeline.map((scheduleItem, idx) => (
                      <TouchableOpacity
                        key={scheduleItem.id}
                        activeOpacity={0.85}
                        onPress={() => handleOpenTask(scheduleItem.id)}
                        style={styles.scheduleRow}
                      >
                        <View style={[styles.rankDot, { backgroundColor: rankColor(idx) }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.taskTitle, { color: text }]}>{scheduleItem.title}</Text>
                          <Text style={[styles.taskReason, { color: subtle }]}>
                            {scheduleItem.startLabel} - {scheduleItem.endLabel} · {scheduleItem.minutes} min ·{" "}
                            {scheduleItem.energy === "deep" ? "Deep focus" : "Quick win"}
                          </Text>
                        </View>
                        {renderTaskActions(openTaskById.get(scheduleItem.id))}
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                <View style={{ marginTop: 14 }}>
                  {agentPlan.prioritized.slice(0, 3).map((task, index) => (
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
                    >
                      <View style={[styles.rankDot, { backgroundColor: rankColor(index) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskTitle, { color: text }]}>{task.title}</Text>
                        <Text style={[styles.taskReason, { color: subtle }]}>{task.reason}</Text>
                      </View>
                      <Text style={[styles.badge, { color: text }]}>{formatDueLabel(task.due_date)}</Text>
                      {renderTaskActions(task)}
                    </TouchableOpacity>
                  ))}
                  {agentPlan.prioritized.length > 3 && (
                    <TouchableOpacity
                      style={styles.showAllBtn}
                      activeOpacity={0.8}
                      onPress={() => setTaskListModal({ title: "Today's game plan", tasks: agentPlan.prioritized })}
                    >
                      <Text style={styles.showAllText}>Show all {agentPlan.prioritized.length} tasks →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        );
      }

      if (item === "suggested") {
        return (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: card, borderColor: border }]}
            activeOpacity={0.96}
            onPress={() => setShowSuggestedOrder((prev) => !prev)}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: text }]}>Suggested order</Text>
              <View style={styles.suggestedHeaderRight}>
                <Text style={[styles.pill, { color: subtle, borderColor: border }]}>
                  {stats.quick} quick wins · {stats.deep} deep work
                </Text>
                <View style={styles.sectionToggleBtn}>
                  <Ionicons
                    name={showSuggestedOrder ? "chevron-down" : "chevron-up"}
                    size={18}
                    color={subtle}
                  />
                </View>
              </View>
            </View>

            {!showSuggestedOrder ? (
              <Text style={[styles.sectionHint, { color: subtle }]}>Tap to expand detailed ordering.</Text>
            ) : (
              <>
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
                        <View key={task.id} style={styles.flowTaskRow}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={{ flex: 1 }}
                            onPress={() => handleOpenTask(task.id)}
                          >
                            <Text style={[styles.flowTask, { color: text }]}>
                              • {task.title} ({task.reason})
                            </Text>
                          </TouchableOpacity>
                          {renderTaskActions(task)}
                        </View>
                      ))}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </TouchableOpacity>
        );
      }

      return (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: card, borderColor: border }]}
          activeOpacity={0.96}
          onPress={() => setShowHowItWorks((prev) => !prev)}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: text }]}>How it works</Text>
            <View style={styles.sectionToggleBtn}>
              <Ionicons name={showHowItWorks ? "chevron-down" : "chevron-up"} size={18} color={subtle} />
            </View>
          </View>
          {showHowItWorks ? (
            <Text style={[styles.sectionHint, { color: subtle }]}>
              We rank tasks locally using due date + difficulty. Overdue and hard tasks get bumped to the
              top, while easy items are saved as quick wins.
            </Text>
          ) : (
            <Text style={[styles.sectionHint, { color: subtle }]}>Tap to see how ranking works.</Text>
          )}
        </TouchableOpacity>
      );
    },
    [
      agentPlan.prioritized,
      agentPlan.sections,
      agentPlan.summary,
      agentPlan.totalMinutes,
      border,
      card,
      dark,
      error,
      goToFilter,
      goToSection,
      handleOpenTask,
      handleStartNextBlock,
      lastRefresh,
      loadTasks,
      openAddTask,
      openChat,
      openTaskById,
      overdueTasks,
      renderTaskActions,
      scheduleTimeline,
      showHowItWorks,
      showSuggestedOrder,
      stats.deep,
      stats.dueSoon,
      stats.open,
      stats.overdue,
      stats.quick,
      subtle,
      text,
    ]
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
        />

        <FlatList
          ref={listRef}
          data={plannerSections}
          keyExtractor={(section) => section}
          renderItem={renderPlannerSection}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: contentTopPadding, paddingBottom: insets.bottom + 132 },
          ]}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshing={refreshing}
          onRefresh={() => loadTasks(true)}
        />

        {chatOpen && (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View
              style={[
                styles.chatOverlay,
                { backgroundColor: overlayColor },
              ]}
            >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            >
                <Animated.View
                  style={[
                    styles.chatSheet,
                    {
                      backgroundColor: chatSheetBackground,
                      width: "100%",
                      flex: 1,
                      paddingTop: insets.top + 10,
                      paddingBottom: Math.max(insets.bottom, 16) + 16, // sit well above tab bar
                      transform: [
                        {
                          translateY: chatAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, screenHeight],
                            extrapolate: "clamp",
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.chatSheetHeader}>
                    <View style={[styles.chatGrabber, { backgroundColor: dark ? "#2A3A53" : "#E2E7F1" }]} />
                  </View>

                  <View style={styles.chatHeader}>
                    <View>
                      <Text style={[styles.chatTitle, { color: text }]}>Planner assistant</Text>
                      <Text style={[styles.chatSubtitle, { color: subtle }]}>
                        Ask for study tips, draft tasks, or sequence your day.
                      </Text>
                    </View>
                    <TouchableOpacity onPress={closeChat} hitSlop={12}>
                      <Ionicons name="close" size={22} color={subtle} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.chatBubble, { backgroundColor: dark ? "#132743" : "#F1F6FF" }]}>
                    <Ionicons name="sparkles" size={16} color="#0A84FF" style={{ marginRight: 6 }} />
                    <Text style={[styles.chatText, { color: text }]}>
                      Try: “What should I tackle first today?” or “Draft a study plan for calculus.”
                    </Text>
                  </View>

                  <View style={styles.chatQuickRow}>
                    <TouchableOpacity
                      onPress={handleClearChat}
                      style={[
                        styles.chatChip,
                        { backgroundColor: dark ? "#1C2D47" : "#EDF3FF", borderColor: dark ? "#2C3D5B" : "#D5E4FF" },
                      ]}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.chatChipText, { color: dark ? "#D9E6FF" : "#0A84FF" }]}>
                        Clear chat
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.chatBody}>
                    <ScrollView
                      ref={chatScrollRef}
                      keyboardShouldPersistTaps="always"
                      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24, gap: 10, flexGrow: 1 }}
                      showsVerticalScrollIndicator={false}
                      scrollEventThrottle={16}
                      alwaysBounceVertical
                    >
                      {chatMessages.map((msg) => {
                        const isUser = msg.from === "user";
                        return (
                          <View
                            key={msg.id}
                            style={[
                              styles.chatRow,
                              isUser ? styles.chatRowUser : styles.chatRowBot,
                            ]}
                          >
                            <Text style={[styles.chatRowText, { color: isUser ? "#fff" : text }]}>
                              {msg.text}
                            </Text>
                            {!isUser && msg.tasks && msg.tasks.length > 0 && (() => {
                              const isExpanded = expandedMessages.has(msg.id);
                              const visibleTasks = isExpanded ? msg.tasks : msg.tasks.slice(0, 3);
                              const hiddenCount = msg.tasks.length - 3;
                              return (
                                <View style={styles.chatTaskList}>
                                  {visibleTasks.map((t) => (
                                    <TouchableOpacity
                                      key={t.id}
                                      style={[
                                        styles.chatTaskPill,
                                        {
                                          backgroundColor: dark ? "#1C2740" : "#F5F8FF",
                                          borderColor: dark ? "#2E3B55" : "#D0D7E5",
                                        },
                                      ]}
                                      activeOpacity={0.9}
                                      delayPressIn={120}
                                      onPress={() => handleOpenTask(t.id)}
                                    >
                                      <Text style={[styles.chatTaskTitle, { color: text }]}>
                                        {t.title}
                                      </Text>
                                      {t.due_date ? (
                                        <Text style={[styles.chatTaskDue, { color: subtle }]}>
                                          {formatDueLabel(t.due_date)}
                                        </Text>
                                      ) : null}
                                    </TouchableOpacity>
                                  ))}
                                  {!isExpanded && hiddenCount > 0 && (
                                    <TouchableOpacity
                                      style={styles.showMoreBtn}
                                      onPress={() =>
                                        setExpandedMessages((prev) => {
                                          const next = new Set(prev);
                                          next.add(msg.id);
                                          return next;
                                        })
                                      }
                                    >
                                      <Text style={styles.showMoreText}>
                                        Show all {msg.tasks.length} →
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              );
                            })()}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={[styles.chatInputBar, { marginBottom: Math.max(insets.bottom + 24, 48) }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={subtle} />
                    <TextInput
                      placeholder="Type a question..."
                      placeholderTextColor={subtle}
                      style={[styles.chatTextInput, { color: text }]}
                      value={chatInput}
                      onChangeText={setChatInput}
                      onSubmitEditing={handleSendMessage}
                      returnKeyType="send"
                      multiline
                    />
                    <TouchableOpacity
                      onPress={handleSendMessage}
                      disabled={!chatInput.trim()}
                      style={[
                        styles.chatSendMock,
                        { opacity: chatInput.trim() ? 1 : 0.4 },
                      ]}
                    >
                      <Ionicons name="send" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        )}
      </View>

      {/* Full task list modal */}
      <Modal
        visible={taskListModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTaskListModal(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: text }]}>{taskListModal?.title}</Text>
            <TouchableOpacity onPress={() => setTaskListModal(null)} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {taskListModal?.tasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskRow, { borderColor: border, backgroundColor: dark ? "#1F1F23" : "#F7F8FA" }]}
                activeOpacity={0.85}
                onPress={() => {
                  setTaskListModal(null);
                  handleOpenTask(task.id);
                }}
              >
                <View style={[styles.rankDot, { backgroundColor: (task.daysUntil ?? 0) < 0 ? "#FF453A" : "#0A84FF" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskTitle, { color: text }]}>{task.title}</Text>
                  <Text style={[styles.taskReason, { color: subtle }]}>
                    {task.reason}
                  </Text>
                </View>
                {task.due_date ? (
                  <Text style={[styles.badge, { color: text, borderColor: border }]}>{formatDueLabel(task.due_date)}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  flowTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyState: {
    fontSize: 15,
  },
  stateBlock: {
    marginTop: 8,
    gap: 10,
  },
  stateActionsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  stateActionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: "flex-start",
  },
  stateActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A84FF",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 14,
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
    justifyContent: "space-between",
    gap: 10,
  },
  startBlockBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  startBlockText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A84FF",
  },
  hero: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 8,
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
  suggestedHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 10,
  },
  sectionToggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
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
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    fontSize: 12,
    fontWeight: "700",
  },
  chatPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chatPromptText: {
    fontSize: 13,
    fontWeight: "700",
  },
  chatOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-start",
    paddingHorizontal: 0,
    paddingTop: 0,
    flex: 1,
  },
  chatSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  chatSheetHeader: {
    alignItems: "center",
    paddingBottom: 4,
  },
  chatGrabber: {
    width: 46,
    height: 5,
    borderRadius: 3,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  chatSubtitle: {
    fontSize: 13,
  },
  chatBubble: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  chatText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  chatQuickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chatChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  chatChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  chatBody: {
    flex: 1,
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingVertical: 12,
    marginTop: 6,
    overflow: "hidden",
  },
  chatRow: {
    maxWidth: "90%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  chatRowUser: {
    alignSelf: "flex-end",
    backgroundColor: "#0A84FF",
    shadowColor: "#0A84FF",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  chatRowBot: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(10,132,255,0.08)",
  },
  chatRowText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatTaskList: {
    marginTop: 8,
    gap: 6,
  },
  chatTaskPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderColor: "#D0D7E5",
    backgroundColor: "#F5F8FF",
  },
  chatTaskTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  chatTaskDue: {
    fontSize: 13,
    marginTop: 2,
  },
  showAllBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: "center",
  },
  showAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A84FF",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalClose: {
    padding: 4,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  showMoreBtn: {
    marginTop: 4,
    paddingVertical: 8,
    alignItems: "center",
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A84FF",
  },
  chatInputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#F7F8FB",
  },
  chatTextInput: {
    flex: 1,
    fontSize: 14,
    minHeight: 40,
    paddingVertical: 4,
  },
  chatSendMock: {
    width: 30,
    height: 30,
    borderRadius: 16,
    backgroundColor: "#0A84FF",
    alignItems: "center",
    justifyContent: "center",
  },
});

// Accent colours for ranked items
function rankColor(index: number) {
  const palette = ["#0A84FF", "#34C759", "#FF9F0A", "#FF453A", "#AF52DE"];
  return palette[index % palette.length];
}
