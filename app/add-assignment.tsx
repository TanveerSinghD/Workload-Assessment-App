import { useColorScheme } from "@/hooks/use-color-scheme";
import { addTask } from "@/lib/database";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export const screenOptions = {
  title: "Add Task",
  headerBackTitle: "",
};

type Difficulty = "easy" | "medium" | "hard";
type Priority = "normal" | "high";
type TaskCategory = "coursework" | "revision" | "project" | "personal";

const TITLE_LIMIT = 60;

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function toISODateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDueLabel(date: Date | null) {
  if (!date) return "No due date";
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return "Due: Today";
  if (target.getTime() === tomorrow.getTime()) return "Due: Tomorrow";
  const formatted = target.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Due: ${formatted}`;
}

function getWeekendDate() {
  const base = startOfToday();
  const day = base.getDay();
  const offset = day === 6 ? 0 : (6 - day + 7) % 7;
  base.setDate(base.getDate() + offset);
  return base;
}

export default function AddAssignmentScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const descriptionRef = useRef<TextInput>(null);

  const colors = useMemo(
    () => ({
      background: dark ? "#11141C" : "#EEF2F9",
      card: dark ? "#1A202C" : "#FFFFFF",
      text: dark ? "#F4F7FF" : "#121620",
      muted: dark ? "#97A1B5" : "#6B7280",
      border: dark ? "rgba(255,255,255,0.12)" : "rgba(10,22,70,0.12)",
      subtleSurface: dark ? "#262E3E" : "#F3F6FB",
      blue: "#0A84FF",
      green: "#22C55E",
      amber: "#F59E0B",
      red: "#EF4444",
    }),
    [dark]
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [priority, setPriority] = useState<Priority>("normal");
  const [category, setCategory] = useState<TaskCategory | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftDate, setDraftDate] = useState(startOfToday());
  const [savingMode, setSavingMode] = useState<"back" | "another" | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [difficultyError, setDifficultyError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const hasUnsavedChanges =
    trimmedTitle.length > 0 ||
    description.trim().length > 0 ||
    dueDate !== null ||
    difficulty !== null ||
    priority !== "normal" ||
    category !== null;
  const canSave = trimmedTitle.length >= 2 && difficulty !== null && savingMode === null;
  const duePreview = formatDueLabel(dueDate);

  usePreventRemove(hasUnsavedChanges && savingMode === null, ({ data }) => {
    Alert.alert("Discard this task?", "You have unsaved changes.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const openDatePicker = useCallback(() => {
    setDraftDate(dueDate ?? startOfToday());
    setShowDatePicker(true);
  }, [dueDate]);

  const onDateChange = useCallback((_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) return;
    const normalized = new Date(selected);
    normalized.setHours(0, 0, 0, 0);
    setDraftDate(normalized);
  }, []);

  const validate = useCallback(() => {
    let valid = true;
    if (trimmedTitle.length === 0) {
      setTitleError("Task title is required.");
      valid = false;
    }
    if (trimmedTitle.length > 0 && trimmedTitle.length < 2) {
      setTitleError("Title should be at least 2 characters.");
      valid = false;
    }
    if (trimmedTitle.length >= 2) {
      setTitleError(null);
    }

    if (!difficulty) {
      setDifficultyError("Select a difficulty before saving.");
      valid = false;
    } else {
      setDifficultyError(null);
    }

    return valid;
  }, [difficulty, trimmedTitle]);

  const saveTask = useCallback(
    async (mode: "back" | "another") => {
      if (!validate()) return;
      setSavingMode(mode);
      try {
        await addTask({
          title: trimmedTitle,
          description: description.trim(),
          difficulty: difficulty!,
          due_date: dueDate ? toISODateLocal(dueDate) : null,
          priority,
          category,
        });

        if (mode === "another") {
          setTitle("");
          setDescription("");
          setDueDate(null);
          setDifficulty(null);
          setPriority("normal");
          setCategory(null);
          setTitleError(null);
          setDifficultyError(null);
          setToast("Task added");
          return;
        }

        router.back();
      } catch (error) {
        if (__DEV__) console.error("Failed to save task", error);
        Alert.alert("Save failed", "Please sign in again and try saving.");
      } finally {
        setSavingMode(null);
      }
    },
    [category, description, difficulty, dueDate, priority, trimmedTitle, validate]
  );

  const difficultyMeta: Record<Difficulty, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    easy: { label: "Easy", icon: "leaf-outline", color: colors.green },
    medium: { label: "Medium", icon: "flash-outline", color: colors.amber },
    hard: { label: "Hard", icon: "flame-outline", color: colors.red },
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1 }}>
          <ScrollView
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 14,
              paddingTop: 14,
              paddingBottom: Math.max(22, insets.bottom + 16),
              flexGrow: 1,
            }}
          >
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.formBody}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Task title</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: titleError ? colors.red : colors.border,
                    backgroundColor: colors.subtleSurface,
                  },
                ]}
                placeholder="e.g. Revise calculus chapter 4"
                placeholderTextColor={colors.muted}
                value={title}
                onChangeText={(next) => {
                  setTitle(next.slice(0, TITLE_LIMIT));
                  if (titleError) setTitleError(null);
                }}
                returnKeyType="next"
                onSubmitEditing={() => descriptionRef.current?.focus()}
              />
              <View style={styles.metaRow}>
                <Text style={[styles.helper, { color: colors.muted }]}>Make it specific and action-oriented.</Text>
                <Text style={[styles.helper, { color: colors.muted }]}>{title.length}/{TITLE_LIMIT}</Text>
              </View>
              {titleError ? <Text style={[styles.errorText, { color: colors.red }]}>{titleError}</Text> : null}

              <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 18 }]}>Due date</Text>
              <View style={styles.quickRow}>
                <QuickChip label="No date" onPress={() => setDueDate(null)} active={dueDate === null} colors={colors} />
                <QuickChip label="Today" onPress={() => setDueDate(startOfToday())} active={duePreview === "Due: Today"} colors={colors} />
                <QuickChip
                  label="Tomorrow"
                  onPress={() => {
                    const t = startOfToday();
                    t.setDate(t.getDate() + 1);
                    setDueDate(t);
                  }}
                  active={duePreview === "Due: Tomorrow"}
                  colors={colors}
                />
                <QuickChip
                  label="This weekend"
                  onPress={() => setDueDate(getWeekendDate())}
                  active={dueDate ? toISODateLocal(dueDate) === toISODateLocal(getWeekendDate()) : false}
                  colors={colors}
                />
              </View>

              <TouchableOpacity
                style={[styles.dueRow, { borderColor: colors.border, backgroundColor: colors.subtleSurface }]}
                onPress={openDatePicker}
                activeOpacity={0.85}
              >
                <View style={styles.dueLeft}>
                  <Ionicons name="calendar-outline" size={18} color={colors.blue} />
                  <Text style={[styles.dueText, { color: colors.text }]}>{duePreview}</Text>
                </View>
                <Text style={[styles.changeText, { color: colors.blue }]}>Change</Text>
              </TouchableOpacity>

              <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 18 }]}>Notes (optional)</Text>
              <TextInput
                ref={descriptionRef}
                style={[
                  styles.textArea,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.subtleSurface },
                ]}
                placeholder="Add details, links, or what 'done' looks like."
                placeholderTextColor={colors.muted}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />

              <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 18 }]}>Difficulty</Text>
              <View style={styles.difficultyRow}>
                {(Object.keys(difficultyMeta) as Difficulty[]).map((level) => {
                  const meta = difficultyMeta[level];
                  const selected = difficulty === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      onPress={() => {
                        setDifficulty(level);
                        if (difficultyError) setDifficultyError(null);
                      }}
                      style={[
                        styles.diffChip,
                        {
                          borderColor: selected ? meta.color : colors.border,
                          backgroundColor: selected ? `${meta.color}22` : colors.subtleSurface,
                        },
                      ]}
                    >
                      <Ionicons name={meta.icon} size={16} color={selected ? meta.color : colors.muted} />
                      <Text
                        style={[
                          styles.diffText,
                          { color: selected ? colors.text : colors.muted, fontWeight: selected ? "800" : "700" },
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {difficultyError ? <Text style={[styles.errorText, { color: colors.red }]}>{difficultyError}</Text> : null}

              <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 18 }]}>Task options</Text>
              <View style={styles.optionRow}>
                <TouchableOpacity
                  onPress={() => setPriority("normal")}
                  style={[
                    styles.optionChip,
                    {
                      borderColor: priority === "normal" ? colors.blue : colors.border,
                      backgroundColor: priority === "normal" ? `${colors.blue}14` : colors.subtleSurface,
                    },
                  ]}
                >
                  <Ionicons name="flag-outline" size={15} color={priority === "normal" ? colors.blue : colors.muted} />
                  <Text style={[styles.optionText, { color: priority === "normal" ? colors.text : colors.muted }]}>Normal priority</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPriority("high")}
                  style={[
                    styles.optionChip,
                    {
                      borderColor: priority === "high" ? colors.red : colors.border,
                      backgroundColor: priority === "high" ? `${colors.red}16` : colors.subtleSurface,
                    },
                  ]}
                >
                  <Ionicons name="flame-outline" size={15} color={priority === "high" ? colors.red : colors.muted} />
                  <Text style={[styles.optionText, { color: priority === "high" ? colors.text : colors.muted }]}>High priority</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 18 }]}>Category (optional)</Text>
              <View style={styles.optionRow}>
                {([
                  ["coursework", "Coursework", "school-outline"],
                  ["revision", "Revision", "book-outline"],
                  ["project", "Project", "layers-outline"],
                  ["personal", "Personal", "person-outline"],
                ] as const).map(([value, label, icon]) => {
                  const selected = category === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setCategory((prev) => (prev === value ? null : value))}
                      style={[
                        styles.optionChip,
                        styles.halfOptionChip,
                        {
                          borderColor: selected ? colors.blue : colors.border,
                          backgroundColor: selected ? `${colors.blue}14` : colors.subtleSurface,
                        },
                      ]}
                    >
                      <Ionicons name={icon} size={15} color={selected ? colors.blue : colors.muted} />
                      <Text style={[styles.optionText, { color: selected ? colors.text : colors.muted }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.actionWrap}>
                <TouchableOpacity
                  onPress={() => void saveTask("another")}
                  style={[styles.secondarySave, { borderColor: colors.border, backgroundColor: colors.subtleSurface }]}
                  disabled={!canSave}
                >
                  <Ionicons name="add-circle-outline" size={17} color={canSave ? colors.text : colors.muted} />
                  <Text style={[styles.secondarySaveText, { color: canSave ? colors.text : colors.muted }]}>
                    {savingMode === "another" ? "Saving..." : "Save & add another"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => void saveTask("back")}
                  style={[styles.primarySave, { backgroundColor: canSave ? colors.blue : `${colors.blue}66` }]}
                  disabled={!canSave}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.primarySaveText}>{savingMode === "back" ? "Saving..." : "Save task"}</Text>
                </TouchableOpacity>
              </View>
              </View>
            </View>
          </ScrollView>

          {toast ? (
            <View style={[styles.toast, { bottom: Math.max(24, insets.bottom + 16) }]}>
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <Modal transparent visible={showDatePicker} animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select due date</Text>
            <DateTimePicker
              value={draftDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={startOfToday()}
              onChange={onDateChange}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={[styles.modalBtn, { borderColor: colors.border }]}>
                <Text style={[styles.modalBtnText, { color: colors.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setDueDate(draftDate);
                  setShowDatePicker(false);
                }}
                style={[styles.modalBtn, { backgroundColor: colors.blue, borderColor: colors.blue }]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>Set date</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function QuickChip({
  label,
  onPress,
  active,
  colors,
}: {
  label: string;
  onPress: () => void;
  active: boolean;
  colors: { blue: string; border: string; subtleSurface: string; text: string; muted: string };
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.quickChip,
        {
          borderColor: active ? colors.blue : colors.border,
          backgroundColor: active ? `${colors.blue}18` : colors.subtleSurface,
        },
      ]}
    >
      <Text style={{ color: active ? colors.text : colors.muted, fontWeight: active ? "800" : "700", fontSize: 13 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  formBody: {
    paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  helper: {
    fontSize: 12,
    fontWeight: "600",
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  dueRow: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dueLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dueText: {
    fontSize: 14,
    fontWeight: "700",
  },
  changeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 8,
  },
  diffChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  diffText: {
    fontSize: 14,
  },
  actionWrap: {
    marginTop: 18,
    paddingTop: 8,
    paddingBottom: 2,
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderWidth: 1.2,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  halfOptionChip: {
    width: "48.5%",
    justifyContent: "center",
  },
  optionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  secondarySave: {
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },
  secondarySaveText: {
    fontSize: 14,
    fontWeight: "700",
  },
  primarySave: {
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#0A84FF",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  primarySaveText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.34)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  modalActions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  modalBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(16,185,129,0.96)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    zIndex: 50,
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
