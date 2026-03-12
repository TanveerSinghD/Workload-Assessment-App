import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useScrollToTop } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { accentThemes } from "@/constants/accent-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useThemeOverride } from "@/hooks/useThemeOverride";
import { getAppLockState } from "@/lib/app-lock-storage";
import { addTask, deleteAllTasks, deleteCompletedTasks } from "@/lib/database";
import {
  DEFAULT_REMINDER_TIME,
  disableReminder,
  enableReminder,
  formatReminderTime,
  loadReminderSettings,
  saveReminderSettings,
  triggerTestNotification,
} from "@/lib/notifications";

type FeedbackTone = "success" | "error" | "info";

type SectionHeaderProps = {
  title: string;
  color: string;
};

function SectionHeader({ title, color }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeaderWrap}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const colors = useThemeColors();
  const { themeOverride, accentTheme, isReady: themeReady } = useThemeOverride();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useScrollToTop(scrollRef);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<{ hour: number; minute: number }>(DEFAULT_REMINDER_TIME);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [appLock, setAppLock] = useState(false);
  const [loadingLock, setLoadingLock] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState<{ hour: number; minute: number }>(DEFAULT_REMINDER_TIME);

  const [searchQuery, setSearchQuery] = useState("");
  const [dangerExpanded, setDangerExpanded] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; tone: FeedbackTone } | null>(null);

  const [seedingDummy, setSeedingDummy] = useState(false);
  const [clearingCompleted, setClearingCompleted] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const background = colors.background;
  const card = colors.surface;
  const text = colors.textPrimary;
  const subtext = colors.textMuted;
  const border = colors.borderSubtle;

  const showFeedback = useCallback((message: string, tone: FeedbackTone = "info") => {
    setFeedback({ message, tone });
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const refreshLockState = useCallback(async () => {
    try {
      const state = await getAppLockState();
      setAppLock(state.enabled);
    } finally {
      setLoadingLock(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    setLoadingReminders(true);
    try {
      const settings = await loadReminderSettings();
      setNotificationsEnabled(settings.enabled);
      setReminderTime({ hour: settings.hour, minute: settings.minute });
    } finally {
      setLoadingReminders(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshLockState();
      refreshNotifications();
    }, [refreshLockState, refreshNotifications])
  );

  const seedDummyTasks = useCallback(async () => {
    if (seedingDummy) return;

    const difficulties = ["easy", "medium", "hard"] as const;
    const subjects = ["Math", "Science", "History", "English", "CS", "Art"];
    const verbs = ["Review", "Draft", "Complete", "Revise", "Outline", "Sketch"];
    const nouns = ["essay", "lab", "notes", "project", "quiz prep", "slides"];

    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatDate = (offset: number) => {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    try {
      setSeedingDummy(true);
      const payload = Array.from({ length: 10 }).map(() => {
        const title = `${verbs[Math.floor(Math.random() * verbs.length)]} ${
          nouns[Math.floor(Math.random() * nouns.length)]
        } (${subjects[Math.floor(Math.random() * subjects.length)]})`;
        const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
        const dateOffset = Math.floor(Math.random() * 14) - 2;
        const due_date = formatDate(dateOffset);

        return {
          title,
          description: `${title} - autogenerated demo task`,
          difficulty,
          due_date,
        };
      });

      await Promise.all(payload.map((task) => addTask(task)));
      showFeedback("Added 10 dummy tasks.", "success");
    } catch (error) {
      if (__DEV__) console.error("Failed to seed dummy tasks", error);
      showFeedback("Could not add dummy tasks. Please try again.", "error");
    } finally {
      setSeedingDummy(false);
    }
  }, [seedingDummy, showFeedback]);

  const clearCompleted = useCallback(() => {
    if (clearingCompleted) return;
    Alert.alert(
      "Clear completed tasks?",
      "This removes all tasks marked as completed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              setClearingCompleted(true);
              await deleteCompletedTasks();
              showFeedback("Completed tasks cleared.", "success");
            } catch (error) {
              if (__DEV__) console.error("Failed to clear completed tasks", error);
              showFeedback("Could not clear completed tasks.", "error");
            } finally {
              setClearingCompleted(false);
            }
          },
        },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  }, [clearingCompleted, dark, showFeedback]);

  const resetDemoData = useCallback(() => {
    if (resettingDemo) return;
    Alert.alert(
      "Reset demo data?",
      "This deletes all tasks and adds fresh dummy tasks.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            const difficulties = ["easy", "medium", "hard"] as const;
            const subjects = ["Math", "Science", "History", "English", "CS", "Art"];
            const verbs = ["Review", "Draft", "Complete", "Revise", "Outline", "Sketch"];
            const nouns = ["essay", "lab", "notes", "project", "quiz prep", "slides"];

            const today = new Date();
            const pad = (n: number) => String(n).padStart(2, "0");
            const formatDate = (offset: number) => {
              const d = new Date(today);
              d.setDate(today.getDate() + offset);
              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            };

            try {
              setResettingDemo(true);
              await deleteAllTasks();

              const payload = Array.from({ length: 10 }).map(() => {
                const title = `${verbs[Math.floor(Math.random() * verbs.length)]} ${
                  nouns[Math.floor(Math.random() * nouns.length)]
                } (${subjects[Math.floor(Math.random() * subjects.length)]})`;
                const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
                const dateOffset = Math.floor(Math.random() * 14) - 2;
                const due_date = formatDate(dateOffset);

                return {
                  title,
                  description: `${title} - autogenerated demo task`,
                  difficulty,
                  due_date,
                };
              });

              await Promise.all(payload.map((task) => addTask(task)));
              showFeedback("Demo data reset complete.", "success");
            } catch (error) {
              if (__DEV__) console.error("Failed to reset demo data", error);
              showFeedback("Reset failed. Please try again.", "error");
            } finally {
              setResettingDemo(false);
            }
          },
        },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  }, [dark, resettingDemo, showFeedback]);

  const clearAllData = useCallback(() => {
    if (clearingAll) return;
    Alert.alert(
      "Delete all tasks?",
      "This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              setClearingAll(true);
              await deleteAllTasks();
              showFeedback("All tasks deleted.", "success");
            } catch (error) {
              if (__DEV__) console.error("Failed to delete tasks", error);
              showFeedback("Delete failed. Please sign in and retry.", "error");
            } finally {
              setClearingAll(false);
            }
          },
        },
      ],
      { userInterfaceStyle: dark ? "dark" : "light" }
    );
  }, [clearingAll, dark, showFeedback]);

  const handleToggleNotifications = useCallback(async () => {
    if (loadingReminders) return;
    setLoadingReminders(true);

    const nextValue = !notificationsEnabled;
    try {
      if (nextValue) {
        const ok = await enableReminder(reminderTime.hour, reminderTime.minute);
        if (!ok) {
          setNotificationsEnabled(false);
          showFeedback("Allow notification permission to enable alerts.", "error");
          return;
        }

        setNotificationsEnabled(true);
        showFeedback(`Alerts enabled (${formatReminderTime(reminderTime.hour, reminderTime.minute)}).`, "success");
      } else {
        await disableReminder();
        setNotificationsEnabled(false);
        showFeedback("Alerts disabled.", "info");
      }
    } catch (error) {
      if (__DEV__) console.error("Notification toggle failed", error);
      showFeedback("Could not update alerts. Try again.", "error");
    } finally {
      setLoadingReminders(false);
    }
  }, [loadingReminders, notificationsEnabled, reminderTime.hour, reminderTime.minute, showFeedback]);

  const handleTimeChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "dismissed") return;
    if (!date) return;
    setTempTime({ hour: date.getHours(), minute: date.getMinutes() });
  }, []);

  const applyTempTime = useCallback(async () => {
    setShowTimePicker(false);
    setReminderTime(tempTime);
    setLoadingReminders(true);

    try {
      if (notificationsEnabled) {
        const ok = await enableReminder(tempTime.hour, tempTime.minute);
        if (!ok) {
          setNotificationsEnabled(false);
          showFeedback("Allow notification permission to apply reminder time.", "error");
          return;
        }
      } else {
        await saveReminderSettings({ enabled: false, hour: tempTime.hour, minute: tempTime.minute });
      }

      showFeedback(`Reminder time set to ${formatReminderTime(tempTime.hour, tempTime.minute)}.`, "success");
    } catch (error) {
      if (__DEV__) console.error("Failed to update reminder time", error);
      showFeedback("Could not update reminder time.", "error");
    } finally {
      setLoadingReminders(false);
    }
  }, [notificationsEnabled, showFeedback, tempTime]);

  const handleSendTest = useCallback(async () => {
    if (!notificationsEnabled) {
      showFeedback("Enable alerts first to send a test notification.", "info");
      return;
    }

    if (loadingReminders || sendingTest) return;

    setSendingTest(true);
    try {
      const ok = await triggerTestNotification();
      if (!ok) {
        showFeedback("Notification permission is blocked.", "error");
      } else {
        showFeedback("Test notification sent.", "success");
      }
    } catch (error) {
      if (__DEV__) console.error("Failed to send test notification", error);
      showFeedback("Could not send test notification.", "error");
    } finally {
      setSendingTest(false);
    }
  }, [loadingReminders, notificationsEnabled, sendingTest, showFeedback]);

  const reminderTimeDisplay = useMemo(
    () => formatReminderTime(reminderTime.hour, reminderTime.minute),
    [reminderTime.hour, reminderTime.minute]
  );

  const activeThemeLabel = themeOverride
    ? themeOverride === "dark"
      ? "Dark"
      : "Light"
    : `System (${scheme === "dark" ? "Dark" : "Light"})`;

  const activeAccentColor = dark ? accentThemes[accentTheme].darkColor : accentThemes[accentTheme].color;

  const feedbackColors = useMemo(() => {
    if (!feedback) return null;

    if (feedback.tone === "success") {
      return {
        bg: dark ? "#173A2B" : "#E9F8EF",
        border: dark ? "#2A7B52" : "#9BDAB8",
        text: dark ? "#D9FBE8" : "#14532D",
        icon: "checkmark-circle",
      } as const;
    }

    if (feedback.tone === "error") {
      return {
        bg: dark ? "#3B1A1A" : "#FDECEC",
        border: dark ? "#8B3A3A" : "#F4A3A3",
        text: dark ? "#FFDCDC" : "#7F1D1D",
        icon: "alert-circle",
      } as const;
    }

    return {
      bg: dark ? "#1C2E46" : "#EAF3FF",
      border: dark ? "#2F5F9A" : "#9BC4F4",
      text: dark ? "#DCEAFF" : "#1E3A8A",
      icon: "information-circle",
    } as const;
  }, [dark, feedback]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matches = useCallback(
    (keywords: string[]) => {
      if (!normalizedQuery) return true;
      const haystack = keywords.join(" ").toLowerCase();
      return normalizedQuery.split(/\s+/).every((token) => haystack.includes(token));
    },
    [normalizedQuery]
  );

  const showAccountSecurity = matches([
    "account",
    "security",
    "app lock",
    "pin",
    user?.name ?? "",
    user?.email ?? "",
  ]);
  const showNotifications = matches(["alerts", "notifications", "daily reminder", "test notification"]);
  const showAppearance = matches(["theme", "appearance", "color theme", "dark mode", "light mode"]);
  const showAdvanced = matches(["quick actions", "navigation", "shortcut"]);
  const showTaskData = matches(["dummy tasks", "task data", "clear completed", "seed"]);
  const showDanger = matches(["danger", "delete", "reset", "clear all"]);
  const showAbout = matches(["version", "developer", "privacy", "terms", "about"]);

  const hasAnyResult =
    showAccountSecurity || showNotifications || showAppearance || showAdvanced || showTaskData || showDanger || showAbout;

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <BlurView intensity={40} tint={dark ? "dark" : "light"} pointerEvents="none" style={styles.blurHeader} />
      <View style={styles.blurFade} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 92, paddingTop: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchWrap}>
          <View style={[styles.searchInputWrap, { backgroundColor: dark ? "#1D1D20" : "#ECEDEF" }]}>
            <Ionicons name="search" size={16} color={subtext} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search settings"
              placeholderTextColor={subtext}
              style={[styles.searchInput, { color: text }]}
              returnKeyType="search"
              accessibilityLabel="Search settings"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={subtext} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {feedback && feedbackColors ? (
          <View style={[styles.feedbackBanner, { backgroundColor: feedbackColors.bg, borderColor: feedbackColors.border }]}> 
            <Ionicons name={feedbackColors.icon} size={16} color={feedbackColors.text} style={{ marginTop: 1 }} />
            <Text style={[styles.feedbackText, { color: feedbackColors.text }]}>{feedback.message}</Text>
          </View>
        ) : null}

        {!hasAnyResult ? (
          <View style={[styles.card, { backgroundColor: card }]}> 
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={[styles.label, { color: text }]}>No matching settings</Text>
              </View>
            </View>
          </View>
        ) : null}

        {showAccountSecurity ? (
          <>
            <SectionHeader
              title="Account & Security"
              color={subtext}
            />
            <View style={[styles.card, { backgroundColor: card }]}> 
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.9}
                onPress={() => router.push("/account")}
                accessibilityRole="button"
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Account</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[styles.value, { color: subtext }]}>{user?.name || user?.email || "Guest"}</Text>
                  <Ionicons name="chevron-forward" size={18} color={subtext} style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>

              <View style={[styles.row, styles.rowDivider, { borderTopColor: border }]}> 
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>App Lock</Text>
                </View>
                {loadingLock ? (
                  <ActivityIndicator size="small" color={activeAccentColor} />
                ) : (
                  <Switch
                    value={appLock}
                    onValueChange={async (value) => {
                      if (loadingLock) return;
                      if (value) {
                        router.push("/set-pin");
                      } else {
                        router.push("/disable-app-lock");
                      }
                    }}
                    disabled={loadingLock}
                    accessibilityLabel="Toggle app lock"
                  />
                )}
              </View>

              {appLock ? (
                <TouchableOpacity
                  style={[styles.row, styles.rowDivider, { borderTopColor: border }]}
                  activeOpacity={0.85}
                  onPress={() => router.push("/change-pin")}
                  accessibilityRole="button"
                >
                  <View style={styles.rowLeft}>
                    <Text style={[styles.label, { color: text }]}>Change PIN</Text>
                  </View>
                  <Text style={[styles.value, { color: subtext }]}>Secure</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        {showNotifications ? (
          <>
            <SectionHeader
              title="Notifications"
              color={subtext}
            />
            <View style={[styles.card, { backgroundColor: card }]}> 
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Enable Alerts</Text>
                </View>
                {loadingReminders ? (
                  <ActivityIndicator size="small" color={activeAccentColor} />
                ) : (
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={handleToggleNotifications}
                    disabled={loadingReminders}
                    accessibilityLabel="Toggle alerts"
                  />
                )}
              </View>

              <TouchableOpacity
                style={[styles.row, styles.rowDivider, { borderTopColor: border }]}
                onPress={() => {
                  if (loadingReminders) return;
                  setTempTime(reminderTime);
                  setShowTimePicker(true);
                }}
                accessibilityRole="button"
                disabled={loadingReminders}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Daily Reminder Time</Text>
                </View>
                <Text style={[styles.value, { color: subtext }]}>{loadingReminders ? "Saving..." : reminderTimeDisplay}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.row, styles.rowDivider, { borderTopColor: border, opacity: notificationsEnabled ? 1 : 0.62 }]}
                onPress={handleSendTest}
                disabled={loadingReminders || sendingTest}
                accessibilityRole="button"
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Send Test Notification</Text>
                </View>
                <Text style={[styles.value, { color: subtext }]}>{sendingTest ? "Sending..." : "Now"}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {showAppearance ? (
          <>
            <SectionHeader
              title="Appearance"
              color={subtext}
            />
            <View style={[styles.card, { backgroundColor: card }]}>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.9}
                onPress={() => router.push("/theme-settings")}
                accessibilityRole="button"
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Theme & Color</Text>
                </View>
                <Text style={[styles.value, { color: subtext, marginRight: 8 }]}>
                  {activeThemeLabel}
                </Text>
                {themeReady ? (
                  <Ionicons name="chevron-forward" size={18} color={subtext} />
                ) : (
                  <ActivityIndicator size="small" color={activeAccentColor} />
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {showAdvanced ? (
          <>
            <SectionHeader
              title="Advanced"
              color={subtext}
            />
            <View style={[styles.card, { backgroundColor: card }]}> 
              <TouchableOpacity style={styles.row} onPress={() => router.push("/nav-quick-actions")} accessibilityRole="button">
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Nav Quick Actions</Text>
                </View>
                <Text style={[styles.value, { color: subtext }]}>Customize</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {showTaskData ? (
          <>
            <SectionHeader
              title="Task Data"
              color={subtext}
            />
            <View style={[styles.card, { backgroundColor: card }]}> 
              <TouchableOpacity
                style={styles.row}
                onPress={seedDummyTasks}
                accessibilityRole="button"
                disabled={seedingDummy || resettingDemo || clearingAll}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Add 10 Dummy Tasks</Text>
                </View>
                <Text style={[styles.value, { color: subtext }]}>{seedingDummy ? "Adding..." : "Instant"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.row, styles.rowDivider, { borderTopColor: border }]}
                onPress={clearCompleted}
                accessibilityRole="button"
                disabled={clearingCompleted || resettingDemo || clearingAll}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Clear Completed Tasks</Text>
                </View>
                <Text style={[styles.value, { color: subtext }]}>{clearingCompleted ? "Clearing..." : "Ready"}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {showDanger ? (
          <>
            <SectionHeader
              title="Danger Zone"
              color={subtext}
            />
            <View style={[styles.card, { backgroundColor: card }]}> 
              <TouchableOpacity
                style={styles.row}
                onPress={() => setDangerExpanded((prev) => !prev)}
                accessibilityRole="button"
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: "#FF453A", fontWeight: "700" }]}>Danger Zone</Text>
                </View>
                <Ionicons
                  name={dangerExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={subtext}
                />
              </TouchableOpacity>

              {dangerExpanded ? (
                <>
                  <TouchableOpacity
                    style={[styles.row, styles.rowDivider, { borderTopColor: border }]}
                    onPress={resetDemoData}
                    accessibilityRole="button"
                    disabled={resettingDemo || clearingAll}
                  >
                    <View style={styles.rowLeft}>
                      <Text style={[styles.label, { color: text }]}>Reset Demo Data</Text>
                    </View>
                    <Text style={[styles.value, { color: subtext }]}>{resettingDemo ? "Resetting..." : "Reset"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.row, styles.rowDivider, { borderTopColor: border }]}
                    onPress={clearAllData}
                    accessibilityRole="button"
                    disabled={clearingAll}
                  >
                    <View style={styles.rowLeft}>
                      <Text style={[styles.label, { color: "#FF453A", fontWeight: "700" }]}>Clear All Tasks</Text>
                    </View>
                    <Text style={[styles.value, { color: "#FF453A" }]}>{clearingAll ? "Deleting..." : "Delete"}</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </>
        ) : null}

        {showAbout ? (
          <>
            <SectionHeader title="About" color={subtext} />
            <View style={[styles.card, { backgroundColor: card }]}> 
              <TouchableOpacity style={styles.row} accessibilityRole="button">
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Version</Text>
                </View>
                <Text style={[styles.value, { color: subtext }]}>1.0.0</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.row, styles.rowDivider, { borderTopColor: border }]} accessibilityRole="button">
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Developer</Text>
                </View>
                <Text style={[styles.value, { color: subtext }]}>Tanveer Singh Dhaliwal</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.row, styles.rowDivider, { borderTopColor: border }]} accessibilityRole="button">
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={subtext} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.row, styles.rowDivider, { borderTopColor: border }]} accessibilityRole="button">
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, { color: text }]}>Terms of Service</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={subtext} />
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal transparent visible={showTimePicker} animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowTimePicker(false)} style={styles.modalOverlay}>
          <TouchableOpacity activeOpacity={1} style={[styles.pickerCard, { backgroundColor: card }]}> 
            <Text style={[styles.modalTitle, { color: text }]}>Select Reminder Time</Text>
            <DateTimePicker
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "spinner"}
              value={new Date(new Date().setHours(tempTime.hour, tempTime.minute, 0, 0))}
              onChange={handleTimeChange}
              minuteInterval={5}
              themeVariant={dark ? "dark" : "light"}
            />
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: activeAccentColor, opacity: loadingReminders ? 0.6 : 1 }]}
              onPress={applyTempTime}
              disabled={loadingReminders}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>{loadingReminders ? "Saving..." : "Set"}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchInputWrap: {
    minHeight: 36,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },

  sectionHeaderWrap: {
    paddingHorizontal: 22,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  card: {
    borderRadius: 14,
    marginBottom: 14,
    paddingVertical: 2,
    marginHorizontal: 16,
    overflow: "hidden",
  },

  row: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  rowDivider: {
    borderTopWidth: 1,
  },
  rowLeft: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontSize: 17,
    fontWeight: "500",
  },
  value: {
    fontSize: 16,
    opacity: 0.95,
  },

  feedbackBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },


  blurHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 20,
  },
  blurFade: {
    position: "absolute",
    top: 80,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 19,
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { height: 8, width: 0 },
    shadowRadius: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  pickerCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  primaryButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
