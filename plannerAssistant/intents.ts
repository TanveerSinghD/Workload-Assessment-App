export type PlannerIntent =
  | "SHOW_TASKS"
  | "FREE_UP_DAY"
  | "SHOW_OVERDUE"
  | "SHOW_PLAN"
  | "SHOW_STATS"
  | "COMPLETE_TASK"
  | "ADD_TASK"
  | "WORKLOAD_CHECK"
  | "STUDY_TIPS"
  | null;

export function detectPlannerIntent(text: string): PlannerIntent {
  const lower = text.toLowerCase();

  if (/(free up|clear my day|make .*empty|empty my day|remove all tasks|move everything off|clear tomorrow)/.test(lower)) {
    return "FREE_UP_DAY";
  }

  if (/(how many|count|stats|statistics).*(task|assignment|work|done|complet)/.test(lower) ||
      /(complet|done|finish).*(task|assignment|work).*(this week|today|last|past|how many|count)/.test(lower) ||
      /my (progress|productivity|performance)/.test(lower)) {
    return "SHOW_STATS";
  }

  if (/(show|view|list|see|what are|what.s|whats).*(overdue|late|past due|missed|behind)/.test(lower) ||
      /(overdue|late|past due|missed|behind).*(task|assignment)/.test(lower)) {
    return "SHOW_OVERDUE";
  }

  if (/(mark|complete|finish|tick|check off|set as done).*(task|assignment|it|this|that)/.test(lower) ||
      /(task|assignment).*(done|complete|finished|tick)/.test(lower)) {
    return "COMPLETE_TASK";
  }

  if (/(add|create|new|make).*(task|assignment|reminder|homework|coursework)/.test(lower) ||
      /(task|assignment|reminder).*(add|create|new)/.test(lower)) {
    return "ADD_TASK";
  }

  if (/(study tip|how to study|how do i study|best way to study|study technique|study method|revision tip|focus tip|concentration|pomodoro|spaced repetition|active recall)/.test(lower)) {
    return "STUDY_TIPS";
  }

  if (/(how busy|workload|too much|overwhelm|schedule look|load like|fit everything|do i have time|can i fit|enough time)/.test(lower)) {
    return "WORKLOAD_CHECK";
  }

  if (/(today.s plan|show.*plan|my plan|what.s.*plan|give me.*plan|plan for today|suggest.*plan|recommend.*plan|prioriti[sz]e|what.*tackle|where.*start|what.*first|do first|start with|what should i do)/.test(lower)) {
    return "SHOW_PLAN";
  }

  if (/(show|what do i have|tasks for|due on|what.s due|schedule for|look like|what.*on)/.test(lower)) {
    return "SHOW_TASKS";
  }

  return null;
}

export function isConfirmation(text: string) {
  return /^(yes|yep|yeah|sure|confirm|do it|ok|okay|go ahead|please do|sounds good|perfect|great|absolutely|definitely)/i.test(text.trim());
}

export function isCancellation(text: string) {
  return /^(no|nah|nope|cancel|stop|wait|hold on|not now|skip|forget it|never mind|nevermind)/i.test(text.trim());
}
