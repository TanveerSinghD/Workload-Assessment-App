import { addTask } from "@/app/database/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Picker } from "@react-native-picker/picker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export const screenOptions = {
  title: "Add Task",
  headerBackTitle: "",
};

export default function AddAssignmentScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const background = dark ? "#1C1C1E" : "#FFFFFF";
  const text = dark ? "#FFFFFF" : "#000000";
  const border = dark ? "#3A3A3C" : "#C7C7CC";

  // Title + Date
  const [title, setTitle] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  // Details
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | null>(null);

  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => String(i + 1)), []);

  const months = useMemo(
    () => [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ],
    []
  );

  const monthNumbers: Record<string, string> = {
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

  // Disable past years
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [String(currentYear), String(currentYear + 1)];
  }, []);

  // Default to today's date
  useEffect(() => {
    const now = new Date();
    setSelectedDay(String(now.getDate()));
    setSelectedMonth(months[now.getMonth()]);
    setSelectedYear(String(now.getFullYear()));
  }, [months]);

  const handleSave = async () => {
    if (!title || !description || !difficulty || !selectedDay || !selectedMonth || !selectedYear) {
      Alert.alert("Missing Fields", "Please fill out all fields before saving.");
      return;
    }

    const monthNum = monthNumbers[selectedMonth];
    const day = selectedDay.padStart(2, "0");

    const dueDate = `${selectedYear}-${monthNum}-${day}`;

    await addTask({
      title,
      description,
      difficulty,
      due_date: dueDate,
    });

    router.back();
  };

  const difficultyColors = {
    easy: "#5CD85C",
    medium: "#FFD93D",
    hard: "#FF4C4C",
  };

  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonthIndex = now.getMonth();
  const currentDay = now.getDate();

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <Text style={[styles.label, { color: text }]}>Task Title</Text>

      <TextInput
        style={[styles.input, { color: text, borderColor: border }]}
        placeholder="Enter task title..."
        placeholderTextColor={dark ? "#8E8E93" : "#A3A3A3"}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={[styles.label, { color: text, marginTop: 20 }]}>Due Date</Text>

      <View style={styles.row}>
        {/* MONTH */}
        <View style={[styles.pickerBox, { borderColor: border }]}>
          <Picker
            selectedValue={selectedMonth}
            onValueChange={(m) => setSelectedMonth(m)}
            dropdownIconColor={text}
            itemStyle={{ fontSize: 16, height: 73 }}
            style={{ transform: [{ translateY: -10 }] }}
          >
            <Picker.Item label="Month" value={null} />
            {months.map((m, index) => {
              const isPastMonth =
                selectedYear === currentYear && index < currentMonthIndex;

              return (
                <Picker.Item
                  key={m}
                  label={m}
                  value={isPastMonth ? null : m}
                  enabled={!isPastMonth}
                  color={isPastMonth ? "#999" : undefined}
                />
              );
            })}
          </Picker>
        </View>

        {/* DAY */}
        <View style={[styles.pickerBox, { borderColor: border }]}>
          <Picker
            selectedValue={selectedDay}
            onValueChange={(d) => setSelectedDay(d)}
            dropdownIconColor={text}
            itemStyle={{ fontSize: 16, height: 73 }}
            style={{ transform: [{ translateY: -10 }] }}
          >
            <Picker.Item label="Day" value={null} />
            {days.map((d) => {
              const isPastDay =
                selectedYear === currentYear &&
                selectedMonth === months[currentMonthIndex] &&
                Number(d) < currentDay;

              return (
                <Picker.Item
                  key={d}
                  label={d}
                  value={isPastDay ? null : d}
                  enabled={!isPastDay}
                  color={isPastDay ? "#999" : undefined}
                />
              );
            })}
          </Picker>
        </View>

        {/* YEAR */}
        <View style={[styles.pickerBox, { borderColor: border, marginRight: 0 }]}>
          <Picker
            selectedValue={selectedYear}
            onValueChange={(y) => setSelectedYear(y)}
            dropdownIconColor={text}
            itemStyle={{ fontSize: 16, height: 73 }}
            style={{ transform: [{ translateY: -10 }] }}
          >
            <Picker.Item label="Year" value={null} />
            {years.map((y) => (
              <Picker.Item key={y} label={y} value={y} />
            ))}
          </Picker>
        </View>
      </View>

      <Text style={[styles.label, { color: text, marginTop: 20 }]}>Description</Text>

      <TextInput
        style={[styles.textArea, { color: text, borderColor: border }]}
        placeholder="Write a short description..."
        placeholderTextColor={dark ? "#8E8E93" : "#A3A3A3"}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={[styles.label, { color: text, marginTop: 20 }]}>Difficulty</Text>

      <View style={styles.tagRow}>
        {(["easy", "medium", "hard"] as const).map((level) => (
          <TouchableOpacity
            key={level}
            onPress={() => setDifficulty(level)}
            style={[
              styles.tagButton,
              {
                borderColor: difficulty === level ? difficultyColors[level] : border,
                backgroundColor: difficulty === level ? difficultyColors[level] + "33" : "transparent",
              },
            ]}
          >
            <Text style={{ color: text, fontSize: 16, fontWeight: "600" }}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>SAVE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },

  label: { fontSize: 18, fontWeight: "600" },

  input: { marginTop: 8, padding: 12, borderWidth: 1, borderRadius: 8, fontSize: 16 },

  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },

  pickerBox: { flex: 1, borderWidth: 1, borderRadius: 10, height: 55, overflow: "hidden", marginRight: 8 },

  textArea: { marginTop: 8, padding: 12, borderWidth: 1, borderRadius: 8, fontSize: 16, minHeight: 90, textAlignVertical: "top" },

  tagRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },

  tagButton: { flex: 1, paddingVertical: 10, marginRight: 8, borderWidth: 2, borderRadius: 8, alignItems: "center" },

  saveButton: { backgroundColor: "#007AFF", paddingVertical: 14, borderRadius: 10, marginTop: 30 },

  saveButtonText: { textAlign: "center", color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
});
