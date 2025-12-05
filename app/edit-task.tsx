import { deleteTask, getTask as getTaskById, updateTask } from "@/lib/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { updateAvailabilityWithFeedback } from "@/utils/availabilityFeedback";
import { Picker } from "@react-native-picker/picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type Difficulty = "easy" | "medium" | "hard";

type Task = {
  id: number;
  title: string;
  notes: string | null;
  difficulty: Difficulty;
  due_date: string;
  completed?: number;
};

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const monthNumbers: Record<(typeof months)[number], string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

const difficultyColors: Record<Difficulty, string> = {
  easy: "#5CD85C",
  medium: "#FFD93D",
  hard: "#FF4C4C",
};

const pickerItemStyle = { fontSize: 16, height: 73 };
const pickerTransformStyle = { transform: [{ translateY: -10 }] };

const formatDueDate = (
  year: string | null,
  month: (typeof months)[number] | null,
  day: string | null
) => {
  if (!year || !month || !day) return null;
  return `${year}-${monthNumbers[month]}-${day.padStart(2, "0")}`;
};

const parseDueDate = (dueDate: string) => {
  const [year, month, day] = dueDate.split("-");
  const monthName = months.find((m) => monthNumbers[m] === month);

  if (!monthName) return null;
  return { year, monthName, day: String(Number(day)) };
};

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams();
  const taskId = Number(id);

  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const text = dark ? "#FFFFFF" : "#000000";
  const border = dark ? "#3A3A3C" : "#C7C7CC";

  // -------------------------
  // State
  // -------------------------
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [completed, setCompleted] = useState(false);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<(typeof months)[number] | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [hasChanges, setHasChanges] = useState(false);

  // -------------------------
  // Date options
  // -------------------------
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => String(i + 1)), []);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 1;
    const minYear = 2025;

    const list = [];
    for (let y = minYear; y <= maxYear; y++) list.push(String(y));
    return list;
  }, []);

  const pickerProps = useMemo(
    () => ({ dropdownIconColor: text, itemStyle: pickerItemStyle, style: pickerTransformStyle }),
    [text]
  );

  // -------------------------
  // Load Task
  // -------------------------
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const raw = await getTaskById(taskId);
        if (!isMounted || !raw) return;

        const result = raw as Task;
        const parsedDate = parseDueDate(result.due_date);

        setTask(result);
        setTitle(result.title);
        setDescription(result.notes || "");
        setDifficulty(result.difficulty);
        setCompleted(!!result.completed);

        if (parsedDate) {
          setSelectedMonth(parsedDate.monthName);
          setSelectedDay(parsedDate.day);
          setSelectedYear(parsedDate.year);
        }
      } catch (error) {
        console.error("Failed to load task", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  const markChanged = () => setHasChanges(true);

  // -------------------------
  // Save Task
  // -------------------------
  const onSave = async () => {
    if (!hasChanges) return;
    const dueDate = formatDueDate(selectedYear, selectedMonth, selectedDay);
    if (!dueDate) {
      Alert.alert("Missing Date", "Please select a complete due date before saving.");
      return;
    }

    try {
      await updateTask({
        id: taskId,
        title,
        notes: description,
        difficulty,
        due_date: dueDate,
      });

      const updated = await updateAvailabilityWithFeedback(taskId, completed, { silentSuccess: true });
      if (!updated) return;

      Alert.alert(
        "Changes saved",
        completed ? "Task updated and marked complete." : "Task updated and left open.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("Failed to save task", error);
      Alert.alert("Save failed", "Couldn't update this task. Please try again.");
    }
  };

  // -------------------------
  // Delete Task
  // -------------------------
  const onDelete = () => {
    Alert.alert(
      "Delete Task",
      "Are you sure you want to delete this task?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTask(taskId);
              router.back();
            } catch (error) {
              console.error("Failed to delete task", error);
              Alert.alert("Delete failed", "Please sign in again and try deleting.");
            }
          },
        },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  };

  if (isLoading) return null;
  if (!task) return null;

  return (
    <>
      {/* Header */}
      <Stack.Screen options={{ title: "Edit Task" }} />

      <ScrollView
        style={[styles.container, { backgroundColor: background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* TITLE */}
        <Text style={[styles.label, { color: text }]}>Task Title</Text>
        <TextInput
          style={[styles.input, { borderColor: border, color: text }]}
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            markChanged();
          }}
          placeholder="Enter task title..."
          placeholderTextColor={dark ? "#8E8E93" : "#A3A3A3"}
        />

        {/* STATUS */}
        <Text style={[styles.label, { color: text, marginTop: 20 }]}>Status</Text>
        <TouchableOpacity
          style={[
            styles.statusToggle,
            {
              borderColor: completed ? "#2ECC71" : border,
              backgroundColor: completed ? "#2ECC7115" : "transparent",
            },
          ]}
          onPress={() => {
            setCompleted((prev) => !prev);
            markChanged();
          }}
        >
          <Text
            style={{
              color: completed ? "#2ECC71" : text,
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            {completed ? "Mark as Not Done" : "Mark as Done"}
          </Text>
        </TouchableOpacity>

        {/* DATE PICKERS */}
        <Text style={[styles.label, { color: text, marginTop: 20 }]}>
          Due Date
        </Text>

        <View style={styles.row}>
          {/* Month */}
          <View style={[styles.pickerBox, { borderColor: border }]}>
            <Picker
              selectedValue={selectedMonth}
              onValueChange={(m: (typeof months)[number] | null) => {
                setSelectedMonth(m);
                markChanged();
              }}
              {...pickerProps}
            >
              <Picker.Item label="Month" value={null} />
              {months.map((m) => (
                <Picker.Item key={m} label={m} value={m} />
              ))}
            </Picker>
          </View>

          {/* Day */}
          <View style={[styles.pickerBox, { borderColor: border }]}>
            <Picker
              selectedValue={selectedDay}
              onValueChange={(d: string | null) => {
                setSelectedDay(d);
                markChanged();
              }}
              {...pickerProps}
            >
              <Picker.Item label="Day" value={null} />
              {days.map((d) => (
                <Picker.Item key={d} label={d} value={d} />
              ))}
            </Picker>
          </View>

          {/* Year */}
          <View style={[styles.pickerBox, { borderColor: border, marginRight: 0 }]}>
            <Picker
              selectedValue={selectedYear}
              onValueChange={(y: string | null) => {
                setSelectedYear(y);
                markChanged();
              }}
              {...pickerProps}
            >
              <Picker.Item label="Year" value={null} />
              {years.map((y) => (
                <Picker.Item key={y} label={y} value={y} />
              ))}
            </Picker>
          </View>
        </View>

        {/* DESCRIPTION */}
        <Text style={[styles.label, { color: text, marginTop: 20 }]}>
          Description
        </Text>
        <TextInput
          style={[styles.textArea, { borderColor: border, color: text }]}
          value={description}
          onChangeText={(t) => {
            setDescription(t);
            markChanged();
          }}
          multiline
          placeholder="Write a short description..."
          placeholderTextColor={dark ? "#8E8E93" : "#A3A3A3"}
        />

        {/* DIFFICULTY */}
        <Text style={[styles.label, { color: text, marginTop: 20 }]}>
          Difficulty
        </Text>

        <View style={styles.tagRow}>
          {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
            <TouchableOpacity
              key={level}
              onPress={() => {
                setDifficulty(level);
                markChanged();
              }}
              style={[
                styles.tagButton,
                {
                  borderColor:
                    difficulty === level ? difficultyColors[level] : border,
                  backgroundColor:
                    difficulty === level
                      ? difficultyColors[level] + "33"
                      : "transparent",
                },
              ]}
            >
              <Text style={{ color: text, fontSize: 16, fontWeight: "600" }}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ACTION BUTTONS */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#FF3B30" }]}
            onPress={onDelete}
          >
            <Text style={styles.actionText}>DELETE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#D1D1D6" }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.actionText, { color: "#333" }]}>CANCEL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: "#34C759" },
              !hasChanges && styles.saveDisabled,
            ]}
            onPress={onSave}
            disabled={!hasChanges}
          >
            <Text style={styles.actionText}>SAVE</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },

  label: { fontSize: 18, fontWeight: "600" },

  input: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 16,
  },

  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },

  pickerBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    height: 55,
    overflow: "hidden",
    marginRight: 8,
  },

  textArea: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 16,
    minHeight: 90,
    textAlignVertical: "top",
  },

  tagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },

  tagButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 2,
    borderRadius: 10,
    alignItems: "center",
  },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 30,
  },

  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  actionText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  saveDisabled: { opacity: 0.35 },

  statusToggle: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderRadius: 10,
    alignItems: "center",
  },
});
