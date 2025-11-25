import { getTasks } from "@/app/database/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
};

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

export default function PlanSectionScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const sectionKey = (params.section as "critical" | "deep" | "quick" | "catch" | undefined) ?? "critical";
  const navigation = useNavigation();

  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const [tasks, setTasks] = useState<Task[]>([]);

  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const card = dark ? "#2C2C2E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const text = dark ? "#FFFFFF" : "#000000";
  const subtle = dark ? "#9A9A9D" : "#6B6B6C";

  const loadTasks = useCallback(async () => {
    const data = await getTasks();
    setTasks(Array.isArray(data) ? (data as Task[]) : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const agentPlan = useMemo(() => {
    const openTasks = tasks.filter((t) => !t.completed);
    const ranked: PlannedTask[] = openTasks
      .map((task) => {
        const dueDate = parseDueDate(task.due_date ?? null);
        const daysUntil = diffInDays(dueDate);

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
        const score = urgency + effort;

        const reasonParts: string[] = [];
        if (daysUntil === null) reasonParts.push("No due date");
        else if (daysUntil < 0) reasonParts.push(`Overdue by ${Math.abs(daysUntil)}d`);
        else if (daysUntil === 0) reasonParts.push("Due today");
        else if (daysUntil === 1) reasonParts.push("Due tomorrow");
        else if (daysUntil <= 7) reasonParts.push(`Due in ${daysUntil}d`);

        if (task.difficulty === "hard") reasonParts.push("High effort");
        else if (task.difficulty === "medium") reasonParts.push("Medium effort");
        else reasonParts.push("Quick win");

        return { ...task, dueDate, daysUntil, score, reason: reasonParts.join(" · ") } as PlannedTask;
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

    return {
      critical,
      deepWork,
      quickWins,
      catchUp,
    };
  }, [tasks]);

  const sectionTasks = useMemo(() => {
    if (sectionKey === "critical") return agentPlan.critical;
    if (sectionKey === "deep") return agentPlan.deepWork;
    if (sectionKey === "quick") return agentPlan.quickWins;
    return agentPlan.catchUp;
  }, [agentPlan, sectionKey]);

  const title =
    sectionKey === "critical"
      ? "Critical path"
      : sectionKey === "deep"
      ? "Deep focus block"
      : sectionKey === "quick"
      ? "Quick wins"
      : "Catch up";

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {sectionTasks.length === 0 ? (
          <Text style={{ color: subtle }}>No tasks in this section.</Text>
        ) : (
          sectionTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.card, { backgroundColor: card, borderColor: border }]}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: "/edit-task", params: { id: String(task.id) } })}
            >
              <Text style={[styles.cardTitle, { color: text }]}>{task.title}</Text>
              <Text style={{ color: subtle }}>
                {task.due_date ? `Due ${task.due_date}` : "No due date"}
              </Text>
              <Text style={{ color: subtle, marginTop: 4 }}>{task.reason}</Text>
              {task.notes ? (
                <Text style={{ color: text, marginTop: 6 }} numberOfLines={2}>
                  {task.notes}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 20, paddingBottom: 50, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
});
