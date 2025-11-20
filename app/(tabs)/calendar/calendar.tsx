import { getTasks } from "@/app/database/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar } from "react-native-calendars";

type Task = {
  id: number;
  title: string;
  notes: string | null;
  difficulty: "easy" | "medium" | "hard";
  due_date: string;
};

export default function CalendarScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [assignments, setAssignments] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // LIVE REFRESH WHEN SCREEN FOCUSES
  useFocusEffect(
    useCallback(() => {
      async function load() {
        const data = (await getTasks()) as Task[];
        setAssignments(data);
      }
      load();
    }, [])
  );

  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  // Difficulty colours
  const difficultyDot = {
    easy: "#34C759",
    medium: "#FFD60A",
    hard: "#FF453A",
  };

  // Marked dates
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    assignments.forEach((task) => {
      const d = task.due_date;
      if (!d) return;

      if (d === todayStr) return;

      let color = "#0A84FF"; // future
      if (d < todayStr) color = "#A1A1A1"; // past

      marks[d] = {
        selected: true,
        selectedColor: color,
        selectedTextColor: "#FFFFFF",
      };
    });

    // TODAY = GREEN
    marks[todayStr] = {
      selected: true,
      selectedColor: "#34C759",
      selectedTextColor: "#FFFFFF",
    };

    return marks;
  }, [assignments, todayStr]);

  const assignmentsForDay = selectedDate
    ? assignments.filter((a) => a.due_date === selectedDate)
    : [];

  const currentMonthStr = `${year}-${String(month).padStart(2, "0")}-01`;

  // RESET
  function resetSelected() {
    setSelectedDate(null);
  }

  // Month arrows
  function goPrevMonth() {
    resetSelected();

    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }

  function goNextMonth() {
    resetSelected();

    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" },
      ]}
    >
      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goPrevMonth}>
          <Text style={[styles.arrow, { color: isDark ? "#FFF" : "#007AFF" }]}>
            {"<"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            resetSelected();
            setShowYearPicker(true);
          }}
        >
          <Text
            style={[
              styles.headerText,
              { color: isDark ? "#FFF" : "#007AFF" },
            ]}
          >
            {year}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            resetSelected();
            setShowMonthPicker(true);
          }}
        >
          <Text
            style={[
              styles.headerText,
              { color: isDark ? "#FFF" : "#007AFF" },
            ]}
          >
            {months[month - 1]}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={goNextMonth}>
          <Text style={[styles.arrow, { color: isDark ? "#FFF" : "#007AFF" }]}>
            {">"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CALENDAR */}
      <Calendar
        key={currentMonthStr}
        current={currentMonthStr}
        onDayPress={(day) => setSelectedDate(day.dateString)}

        /* ⭐ FIXED: updates header when swiping months */
        onMonthChange={(date) => {
          setYear(date.year);
          setMonth(date.month);
          resetSelected();
        }}

        markedDates={markedDates}
        hideExtraDays={true}
        hideArrows
        enableSwipeMonths
        renderHeader={() => null}
        theme={{
          calendarBackground: isDark ? "#1C1C1E" : "#FFFFFF",
          dayTextColor: isDark ? "#FFFFFF" : "#000000",
          textDisabledColor: isDark ? "#666666" : "#CCCCCC",
          textSectionTitleColor: isDark ? "#B0B0B0" : "#999999",
          textDayFontSize: 16,
        }}
      />

      {/* TASK LIST */}
      <View style={styles.taskListContainer}>
        {selectedDate ? (
          assignmentsForDay.length === 0 ? (
            <Text style={[styles.noTasksText, { color: isDark ? "#BBB" : "#666" }]}>
              No assignments due.
            </Text>
          ) : (
            assignmentsForDay.map((item) => (
              <Link
                key={item.id}
                href={{ pathname: "/edit-task", params: { id: item.id } }}
                asChild
              >
                <TouchableOpacity style={styles.taskCard}>
                  <View style={styles.taskHeaderRow}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: difficultyDot[item.difficulty] },
                      ]}
                    />
                    <Text style={styles.taskTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.taskDue}>Due {item.due_date}</Text>
                </TouchableOpacity>
              </Link>
            ))
          )
        ) : (
          <Text style={[styles.noTasksText, { color: isDark ? "#BBB" : "#666" }]}>
            Select a date to view assignments.
          </Text>
        )}
      </View>

      {/* PICKERS */}
      {/* YEAR PICKER */}
      <Modal visible={showYearPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowYearPicker(false)}
        >
          <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
            <Text style={styles.modalTitle}>Select Year</Text>

            {[2025, 2026, 2027].map((y) => (
              <TouchableOpacity
                key={y}
                style={styles.modalItem}
                onPress={() => {
                  resetSelected();
                  setYear(y);
                  setShowYearPicker(false);
                }}
              >
                <Text style={{ fontSize: 18 }}>{y}</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MONTH PICKER */}
      <Modal visible={showMonthPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowMonthPicker(false)}
        >
          <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
            <Text style={styles.modalTitle}>Select Month</Text>
            {months.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={styles.modalItem}
                onPress={() => {
                  resetSelected();
                  setMonth(i + 1);
                  setShowMonthPicker(false);
                }}
              >
                <Text style={{ fontSize: 18 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* --------------------- STYLES ----------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 70,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 10,
  },

  arrow: {
    fontSize: 28,
    fontWeight: "600",
    paddingHorizontal: 6,
  },

  headerText: {
    fontSize: 22,
    fontWeight: "700",
  },

  taskListContainer: {
    padding: 16,
  },

  noTasksText: {
    fontSize: 16,
  },

  taskCard: {
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },

  taskHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },

  taskTitle: {
    fontSize: 18,
    fontWeight: "600",
  },

  taskDue: {
    fontSize: 15,
    color: "#666",
    marginTop: 2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    width: "80%",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },

  modalItem: {
    paddingVertical: 10,
  },
});
