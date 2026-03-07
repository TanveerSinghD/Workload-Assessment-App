import { router } from "expo-router";
import { addTask, deleteTask, updateTask } from "@/lib/database";
import { updateAvailabilityWithFeedback } from "@/utils/availabilityFeedback";
import { disableReminder, enableReminder, saveReminderSettings } from "@/lib/notifications";
import { saveNavQuickAction } from "@/lib/nav-quick-actions-store";
import { AssistantAction } from "./types";

export type ActionDeps = {
  onTasksChanged?: () => Promise<void> | void;
  onRefreshPlan?: () => Promise<void> | void;
  debug?: boolean;
};

async function exec(action: AssistantAction, deps: ActionDeps) {
  if (deps.debug) {
    console.log("[assistant_action]", action);
  }
  switch (action.type) {
    case "NAVIGATE":
      router.navigate({ pathname: action.payload.route as any, params: action.payload.params });
      return;
    case "SET_TASK_FILTER":
      router.navigate({ pathname: "/(tabs)/tasks/tasks", params: { filter: action.payload.filter } });
      return;
    case "OPEN_COMPLETED_TASKS":
      router.navigate("/completed-tasks");
      return;
    case "CREATE_TASK": {
      const due = action.payload.due_date ?? null;
      await addTask({
        title: action.payload.title,
        description: action.payload.description ?? action.payload.title,
        difficulty: action.payload.difficulty ?? "medium",
        due_date: due,
      });
      await deps.onTasksChanged?.();
      return;
    }
    case "UPDATE_TASK": {
      await updateTask({
        id: action.payload.id,
        title: action.payload.title ?? "",
        notes: action.payload.notes ?? "",
        difficulty: action.payload.difficulty ?? "medium",
        due_date: action.payload.due_date ?? null,
      });
      await deps.onTasksChanged?.();
      return;
    }
    case "COMPLETE_TASK": {
      await updateAvailabilityWithFeedback(action.payload.id, action.payload.value ?? true);
      await deps.onTasksChanged?.();
      return;
    }
    case "DELETE_TASK": {
      await deleteTask(action.payload.id);
      await deps.onTasksChanged?.();
      return;
    }
    case "REFRESH_PLAN":
      await deps.onRefreshPlan?.();
      return;
    case "SET_SETTING": {
      if (action.payload.key === "notificationsEnabled") {
        if (action.payload.value) {
          const time = action.payload.reminderTime;
          await enableReminder(time?.hour ?? 9, time?.minute ?? 0);
        } else {
          await disableReminder();
          await saveReminderSettings({ enabled: false, hour: 9, minute: 0 });
        }
      }
      return;
    }
    case "UPDATE_NAV_QUICK_ACTION":
      await saveNavQuickAction(action.payload.navId as any, action.payload.actionId as any);
      return;
    default:
      return;
  }
}

export async function runAssistantActions(actions: AssistantAction[] = [], deps: ActionDeps = {}) {
  for (const action of actions) {
    await exec(action, deps);
  }
}
