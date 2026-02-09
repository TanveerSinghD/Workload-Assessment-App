export type PlannerIntent = "SHOW_TASKS" | "FREE_UP_DAY" | null;

export function detectPlannerIntent(text: string): PlannerIntent {
  const lower = text.toLowerCase();
  if (/(free up|clear my day|make .*empty|empty my day|remove all tasks|move everything off|clear tomorrow)/.test(lower)) {
    return "FREE_UP_DAY";
  }
  if (/(show|what do i have|tasks for|due on|what's due|schedule for|look like)/.test(lower)) {
    return "SHOW_TASKS";
  }
  return null;
}

export function isConfirmation(text: string) {
  return /^(yes|yep|yeah|sure|confirm|do it|ok|okay|go ahead|please do)/i.test(text.trim());
}

export function isCancellation(text: string) {
  return /^(no|nah|cancel|stop|wait|hold on|not now)/i.test(text.trim());
}
