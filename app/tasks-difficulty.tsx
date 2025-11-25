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

export default function TasksByDifficultyScreen() {
  const params = useLocalSearchParams<{ level?: string }>();
  const level = (params.level as "easy" | "medium" | "hard" | undefined) ?? "easy";
  const navigation = useNavigation();

  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const [tasks, setTasks] = useState<Task[]>([]);

  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const card = dark ? "#2C2C2E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const text = dark ? "#FFFFFF" : "#000000";
  const subtle = dark ? "#9A9A9D" : "#6B6B6C";

  const load = useCallback(async () => {
    const data = await getTasks();
    setTasks(Array.isArray(data) ? (data as Task[]) : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    return tasks.filter((t) => t.difficulty === level && !t.completed);
  }, [tasks, level]);

  const title =
    level === "easy" ? "Easy tasks" : level === "medium" ? "Medium tasks" : "Hard tasks";

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={{ color: subtle, marginTop: 12 }}>No tasks here.</Text>
        ) : (
          filtered.map((task) => (
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
