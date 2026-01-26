import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type ReminderSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
};

const ENABLED_KEY = "reminder_enabled";
const TIME_KEY = "reminder_time";
const SCHEDULE_ID_KEY = "reminder_schedule_id";

export const DEFAULT_REMINDER_TIME = { hour: 9, minute: 0 };

let handlerRegistered = false;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ensureHandler() {
  if (handlerRegistered) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerRegistered = true;
}

async function ensureAndroidChannel(): Promise<string | undefined> {
  if (Platform.OS !== "android") return undefined;
  const channelId = "daily-reminder";
  await Notifications.setNotificationChannelAsync(channelId, {
    name: "Daily Reminder",
    importance: Notifications.AndroidImportance.HIGH,
    sound: undefined,
  });
  return channelId;
}

function parseTime(raw: string | null): { hour: number; minute: number } | null {
  if (!raw) return null;
  const [h, m] = raw.split(":").map((v) => Number.parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { hour: Math.max(0, Math.min(23, h)), minute: Math.max(0, Math.min(59, m)) };
}

async function saveScheduleId(id: string | null) {
  if (!id) {
    await SecureStore.deleteItemAsync(SCHEDULE_ID_KEY);
  } else {
    await SecureStore.setItemAsync(SCHEDULE_ID_KEY, id);
  }
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  const enabledRaw = await SecureStore.getItemAsync(ENABLED_KEY);
  const timeRaw = await SecureStore.getItemAsync(TIME_KEY);
  const parsedTime = parseTime(timeRaw);
  return {
    enabled: enabledRaw === "true",
    hour: parsedTime?.hour ?? DEFAULT_REMINDER_TIME.hour,
    minute: parsedTime?.minute ?? DEFAULT_REMINDER_TIME.minute,
  };
}

export async function saveReminderSettings(settings: ReminderSettings) {
  await SecureStore.setItemAsync(ENABLED_KEY, settings.enabled ? "true" : "false");
  await SecureStore.setItemAsync(TIME_KEY, `${pad(settings.hour)}:${pad(settings.minute)}`);
}

export function formatReminderTime(hour: number, minute: number) {
  const now = new Date();
  now.setHours(hour);
  now.setMinutes(minute);
  now.setSeconds(0);
  now.setMilliseconds(0);
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.status === Notifications.PermissionStatus.GRANTED) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted || req.status === Notifications.PermissionStatus.GRANTED;
}

export async function cancelScheduledReminder() {
  const existingId = await SecureStore.getItemAsync(SCHEDULE_ID_KEY);
  if (existingId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existingId);
    } catch (error) {
      console.warn("Failed to cancel reminder", error);
    }
  }
  await saveScheduleId(null);
}

export async function scheduleDailyReminder(hour: number, minute: number) {
  ensureHandler();
  const channelId = await ensureAndroidChannel();
  await cancelScheduledReminder();
  const trigger: Notifications.NotificationTriggerInput =
    Platform.select({
      android: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId,
      },
      default: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    }) ?? {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    };

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Work Assessor",
      body: "Hey! Why not get back to work.",
    },
    trigger,
  });
  await saveScheduleId(id);
}

export async function enableReminder(hour: number, minute: number): Promise<boolean> {
  const permitted = await requestNotificationPermission();
  if (!permitted) {
    await saveReminderSettings({ enabled: false, hour, minute });
    return false;
  }
  await scheduleDailyReminder(hour, minute);
  await saveReminderSettings({ enabled: true, hour, minute });
  return true;
}

export async function disableReminder() {
  await cancelScheduledReminder();
  const current = await loadReminderSettings();
  await saveReminderSettings({ ...current, enabled: false });
}

export async function triggerTestNotification() {
  ensureHandler();
  const permitted = await requestNotificationPermission();
  if (!permitted) return false;
  const channelId = await ensureAndroidChannel();
  const trigger: Notifications.TimeIntervalTriggerInput =
    Platform.select({
      android: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId,
        repeats: false,
      },
      default: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        repeats: false,
      },
    }) ?? {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      repeats: false,
    };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Work Assessor",
      body: "Hey! Why not get back to work.",
    },
    trigger,
  });
  return true;
}
