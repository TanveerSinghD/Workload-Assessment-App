import { getTasks } from "@/lib/database";
import { loadReminderSettings } from "@/lib/notifications";
import { loadNavQuickActions } from "@/lib/nav-quick-actions-store";

export type AssistantContext = {
  tasks: Awaited<ReturnType<typeof getTasks>>;
  counts: {
    open: number;
    overdue: number;
    today: number;
    week: number;
    completed: number;
  };
  reminder: Awaited<ReturnType<typeof loadReminderSettings>> | null;
  navQuickActions: Awaited<ReturnType<typeof loadNavQuickActions>> | null;
};

export async function buildAssistantContext(): Promise<AssistantContext> {
  const tasks = (await getTasks()) as any[];
  let open = 0;
  let overdue = 0;
  let today = 0;
  let week = 0;
  let completed = 0;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  tasks.forEach((t) => {
    if (t.completed) {
      completed += 1;
      return;
    }
    open += 1;
    if (!t.due_date) return;
    const d = new Date(`${t.due_date}T00:00:00`);
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 0) overdue += 1;
    else if (diff === 0) today += 1;
    else if (diff <= 7) week += 1;
  });

  let reminder: AssistantContext["reminder"] = null;
  try {
    reminder = await loadReminderSettings();
  } catch {
    reminder = null;
  }

  let navQuickActions: AssistantContext["navQuickActions"] = null;
  try {
    navQuickActions = await loadNavQuickActions();
  } catch {
    navQuickActions = null;
  }

  return { tasks, counts: { open, overdue, today, week, completed }, reminder, navQuickActions };
}
