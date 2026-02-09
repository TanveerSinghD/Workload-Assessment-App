import { parseDateQuery } from "@/plannerAssistant/dateUtils";
import { detectPlannerIntent } from "@/plannerAssistant/intents";
import { getTasks } from "@/lib/database";

async function run() {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const scenarios = [
    "show me tasks for today",
    "show tasks 4 weeks from today",
    "show tasks on the 24th of April",
    "April next year",
    "free up my day tomorrow",
  ];

  const tasks = await getTasks();

  for (const phrase of scenarios) {
    const intent = detectPlannerIntent(phrase);
    const parsed = parseDateQuery(phrase, now, timezone);

    let taskCount = 0;
    if (intent === "SHOW_TASKS" && parsed) {
      if (parsed.type === "day") {
        taskCount = tasks.filter((t) => !t.completed && t.due_date === parsed.startISO).length;
      } else {
        taskCount = tasks.filter(
          (t) => !t.completed && t.due_date && t.due_date >= parsed.startISO && t.due_date <= parsed.endISO
        ).length;
      }
    } else if (intent === "FREE_UP_DAY" && parsed?.type === "day") {
      taskCount = tasks.filter((t) => !t.completed && t.due_date === parsed.startISO).length;
    }

    console.log({
      phrase,
      intent,
      parsed,
      taskCount,
    });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
