import { toISODateLocal } from "@/plannerAssistant/dateUtils";

export type ConversationTaskRef = {
  id: string;
  title: string;
};

export type ConversationContext = {
  lastAskedDateISO: string | null;
  lastListedDateISO: string | null;
  lastActionDateISO: string | null;
  lastMentionedDateISO: string | null;
  lastAnchorDateISO: string | null;
  lastListedTasks: ConversationTaskRef[];
  nowISO: string;
};

export type ConversationIntent = "LIST_TASKS" | "MOVE_TASK" | "OTHER";

export type RelativeDateKind =
  | "TODAY"
  | "TOMORROW"
  | "YESTERDAY"
  | "NEXT_WEEK"
  | "NEXT_MONTH"
  | "DAY_AFTER"
  | "DAY_BEFORE"
  | "NEXT_WEEKDAY";

export type CoreferenceDateKind = "THAT_DATE" | "THAT_DAY" | "NEW_DATE" | "MOVED_DATE" | "THEN";

export type DateRef =
  | { type: "ABSOLUTE"; iso: string }
  | { type: "DAY_OF_MONTH"; day: number; month?: number; year?: number }
  | { type: "RELATIVE"; kind: RelativeDateKind; day?: number; weekday?: number; useAnchor?: boolean }
  | { type: "COREFERENCE"; kind: CoreferenceDateKind };

export type MoveTargetResolution =
  | { kind: "tasks"; taskIds: string[]; source: "title" | "ordinal" | "pronoun" | "all" }
  | { kind: "clarify"; options: ConversationTaskRef[] }
  | { kind: "none"; reason: "no_reference" | "not_found" };

export type SearchableTask = {
  id: string;
  title: string;
};

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTH_PATTERN =
  "(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)";

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseISODate(iso: string | null | undefined) {
  if (!iso) return null;
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function buildDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function addDays(base: Date, amount: number) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + amount);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function normalizeSpaces(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function inferMonthYear(context: ConversationContext, today: Date) {
  const fromAsked = parseISODate(context.lastAskedDateISO);
  if (fromAsked) {
    return { month: fromAsked.getMonth() + 1, year: fromAsked.getFullYear() };
  }
  const fromListed = parseISODate(context.lastListedDateISO);
  if (fromListed) {
    return { month: fromListed.getMonth() + 1, year: fromListed.getFullYear() };
  }
  return { month: today.getMonth() + 1, year: today.getFullYear() };
}

function parseYear(raw: string | undefined) {
  if (!raw) return undefined;
  const year = Number(raw);
  if (Number.isNaN(year)) return undefined;
  if (raw.length === 2) return 2000 + year;
  return year;
}

function nextWeekday(base: Date, weekday: number) {
  const current = base.getDay();
  let offset = (weekday - current + 7) % 7;
  if (offset === 0) offset = 7;
  return addDays(base, offset);
}

function normalizeTitle(title: string) {
  return normalizeSpaces(title);
}

function findByTitle(tasks: SearchableTask[], rawTitle: string) {
  const needle = normalizeTitle(rawTitle);
  const exact = tasks.find((task) => normalizeTitle(task.title) === needle);
  if (exact) return exact;
  return tasks.find((task) => normalizeTitle(task.title).includes(needle));
}

function getOrdinalIndex(lower: string): number | null {
  if (/\b(first|1st)\b/.test(lower)) return 0;
  if (/\b(second|2nd)\b/.test(lower)) return 1;
  if (/\b(third|3rd)\b/.test(lower)) return 2;
  if (/\b(last)\b/.test(lower)) return -1;
  return null;
}

export function createConversationContext(now = new Date()): ConversationContext {
  return {
    lastAskedDateISO: null,
    lastListedDateISO: null,
    lastActionDateISO: null,
    lastMentionedDateISO: null,
    lastAnchorDateISO: null,
    lastListedTasks: [],
    nowISO: toISODateLocal(now),
  };
}

export function detectIntent(message: string): ConversationIntent {
  const lower = normalizeSpaces(message);
  if (!lower) return "OTHER";

  if (/\b(move|push|shift|reschedule)\b/.test(lower)) {
    return "MOVE_TASK";
  }

  if (
    /\b(show|list)\b/.test(lower) ||
    /\bwhat about\b/.test(lower) ||
    /\bhow about\b/.test(lower) ||
    /\btasks for\b/.test(lower) ||
    /\bdue on\b/.test(lower) ||
    /\bschedule for\b/.test(lower) ||
    /\bthat date\b/.test(lower) ||
    /\bthat day\b/.test(lower) ||
    /\bthen\b/.test(lower) ||
    /\bdate you moved\b/.test(lower)
  ) {
    return "LIST_TASKS";
  }

  return extractDateRef(message) ? "LIST_TASKS" : "OTHER";
}

export function isExplicitDateRef(ref: DateRef | null): boolean {
  return !!ref && ref.type !== "COREFERENCE";
}

export function extractDateRef(message: string): DateRef | null {
  const lower = normalizeSpaces(message);
  if (!lower) return null;

  const absoluteISO = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (absoluteISO) {
    const iso = `${absoluteISO[1]}-${absoluteISO[2]}-${absoluteISO[3]}`;
    if (parseISODate(iso)) {
      return { type: "ABSOLUTE", iso };
    }
  }

  if (
    /\b(date you moved (?:it|them)? to|date (?:it|they) (?:was|were) moved to|where you moved (?:it|them))\b/.test(
      lower
    )
  ) {
    return { type: "COREFERENCE", kind: "MOVED_DATE" };
  }

  if (/\bnew date\b/.test(lower)) {
    return { type: "COREFERENCE", kind: "NEW_DATE" };
  }

  if (/\bthat date\b/.test(lower)) {
    return { type: "COREFERENCE", kind: "THAT_DATE" };
  }

  if (/\bthat day\b/.test(lower)) {
    return { type: "COREFERENCE", kind: "THAT_DAY" };
  }

  if (/\bthen\b/.test(lower)) {
    return { type: "COREFERENCE", kind: "THEN" };
  }

  if (/\bday after\b/.test(lower)) {
    return { type: "RELATIVE", kind: "DAY_AFTER" };
  }

  if (/\bday before\b/.test(lower)) {
    return { type: "RELATIVE", kind: "DAY_BEFORE" };
  }

  if (/\btoday\b/.test(lower)) {
    return { type: "RELATIVE", kind: "TODAY" };
  }

  if (/\btomorrow\b/.test(lower)) {
    return { type: "RELATIVE", kind: "TOMORROW" };
  }

  if (/\byesterday\b/.test(lower)) {
    return { type: "RELATIVE", kind: "YESTERDAY" };
  }

  const nextMonthOnDay =
    lower.match(/\bnext month(?:\s+on)?\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/) ??
    lower.match(/\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+of\s+next month\b/);
  if (nextMonthOnDay) {
    const day = Number(nextMonthOnDay[1]);
    if (day >= 1 && day <= 31) {
      return { type: "RELATIVE", kind: "NEXT_MONTH", day };
    }
  }

  const dayMonth = lower.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_PATTERN}(?:\\s+(\\d{2,4}))?\\b`)
  );
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const month = MONTHS[dayMonth[2]];
    const year = parseYear(dayMonth[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { type: "DAY_OF_MONTH", day, month, year };
    }
  }

  const monthDay = lower.match(
    new RegExp(`\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,\\s*|\\s+)?(\\d{2,4})?\\b`)
  );
  if (monthDay) {
    const month = MONTHS[monthDay[1]];
    const day = Number(monthDay[2]);
    const year = parseYear(monthDay[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { type: "DAY_OF_MONTH", day, month, year };
    }
  }

  const numericDayMonth = lower.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (numericDayMonth) {
    const day = Number(numericDayMonth[1]);
    const month = Number(numericDayMonth[2]);
    const year = parseYear(numericDayMonth[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { type: "DAY_OF_MONTH", day, month, year };
    }
  }

  const weekday = lower.match(
    /\b(?:(next|that)\s+)?(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thurs|friday|fri|saturday|sat|sunday|sun)\b/
  );
  if (weekday) {
    const modifier = weekday[1];
    const weekdayNumber = WEEKDAYS[weekday[2]];
    if (weekdayNumber !== undefined) {
      return {
        type: "RELATIVE",
        kind: "NEXT_WEEKDAY",
        weekday: weekdayNumber,
        useAnchor: modifier === "that",
      };
    }
  }

  if (/\bnext week\b/.test(lower)) {
    return { type: "RELATIVE", kind: "NEXT_WEEK" };
  }

  if (/\bnext month\b/.test(lower)) {
    return { type: "RELATIVE", kind: "NEXT_MONTH" };
  }

  const contextualDay =
    lower.match(/\b(?:for|on|to|about)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/) ??
    lower.match(/\b(?:what|how)\s+about\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (contextualDay) {
    const day = Number(contextualDay[1]);
    if (day >= 1 && day <= 31) {
      return { type: "DAY_OF_MONTH", day };
    }
  }

  const plainDay =
    lower.match(/^\s*the\s+(\d{1,2})(?:st|nd|rd|th)?\s*$/) ??
    lower.match(/^\s*(\d{1,2})(?:st|nd|rd|th)?\s*$/);
  if (plainDay) {
    const day = Number(plainDay[1]);
    if (day >= 1 && day <= 31) {
      return { type: "DAY_OF_MONTH", day };
    }
  }

  return null;
}

export function resolveDateRef(ref: DateRef | null, context: ConversationContext, now = new Date()): string | null {
  if (!ref) return null;

  const today = parseISODate(context.nowISO) ?? startOfDay(now);
  const monthYear = inferMonthYear(context, today);

  if (ref.type === "ABSOLUTE") {
    return parseISODate(ref.iso) ? ref.iso : null;
  }

  if (ref.type === "DAY_OF_MONTH") {
    const month = ref.month ?? monthYear.month;
    const year = ref.year ?? monthYear.year;
    const date = buildDate(year, month, ref.day);
    return date ? toISODateLocal(date) : null;
  }

  if (ref.type === "COREFERENCE") {
    if (ref.kind === "MOVED_DATE") {
      return (
        context.lastActionDateISO ??
        context.lastAnchorDateISO ??
        context.lastListedDateISO ??
        context.lastAskedDateISO ??
        null
      );
    }
    if (ref.kind === "NEW_DATE") {
      return (
        context.lastMentionedDateISO ??
        context.lastActionDateISO ??
        context.lastAnchorDateISO ??
        context.lastListedDateISO ??
        context.lastAskedDateISO ??
        null
      );
    }
    return (
      context.lastAnchorDateISO ??
      context.lastActionDateISO ??
      context.lastListedDateISO ??
      context.lastAskedDateISO ??
      null
    );
  }

  switch (ref.kind) {
    case "TODAY":
      return toISODateLocal(today);
    case "TOMORROW":
      return toISODateLocal(addDays(today, 1));
    case "YESTERDAY":
      return toISODateLocal(addDays(today, -1));
    case "NEXT_WEEK":
      return toISODateLocal(addDays(today, 7));
    case "NEXT_MONTH": {
      const firstOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      firstOfNextMonth.setHours(0, 0, 0, 0);
      const day = ref.day ?? today.getDate();
      const date = buildDate(firstOfNextMonth.getFullYear(), firstOfNextMonth.getMonth() + 1, day);
      return date ? toISODateLocal(date) : null;
    }
    case "DAY_AFTER": {
      const anchor = parseISODate(context.lastAnchorDateISO) ?? today;
      return toISODateLocal(addDays(anchor, 1));
    }
    case "DAY_BEFORE": {
      const anchor = parseISODate(context.lastAnchorDateISO) ?? today;
      return toISODateLocal(addDays(anchor, -1));
    }
    case "NEXT_WEEKDAY": {
      const base = ref.useAnchor ? parseISODate(context.lastAnchorDateISO) ?? today : today;
      const weekday = ref.weekday ?? 1;
      return toISODateLocal(nextWeekday(base, weekday));
    }
    default:
      return null;
  }
}

export function updateContextForList(
  context: ConversationContext,
  resolvedDateISO: string,
  listedTasks: ConversationTaskRef[],
  mentionedDateISO?: string | null
): ConversationContext {
  return {
    ...context,
    lastAskedDateISO: resolvedDateISO,
    lastListedDateISO: resolvedDateISO,
    lastAnchorDateISO: resolvedDateISO,
    lastListedTasks: listedTasks,
    lastMentionedDateISO: mentionedDateISO ?? context.lastMentionedDateISO,
  };
}

export function updateContextForMove(
  context: ConversationContext,
  destinationISO: string,
  movedTasks: ConversationTaskRef[],
  mentionedDateISO?: string | null
): ConversationContext {
  return {
    ...context,
    lastActionDateISO: destinationISO,
    lastAnchorDateISO: destinationISO,
    lastListedTasks: movedTasks.length ? movedTasks : context.lastListedTasks,
    lastMentionedDateISO: mentionedDateISO ?? context.lastMentionedDateISO,
  };
}

export function extractMoveTarget(
  message: string,
  context: ConversationContext,
  tasks: SearchableTask[]
): MoveTargetResolution {
  const lower = normalizeSpaces(message);
  const listed = context.lastListedTasks;

  if (/\b(them all|all of them|move all|all tasks|everything)\b/.test(lower)) {
    if (!listed.length) return { kind: "none", reason: "no_reference" };
    return { kind: "tasks", taskIds: listed.map((task) => task.id), source: "all" };
  }

  const quoteMatch =
    message.match(/"([^"]+)"/) ?? message.match(/'([^']+)'/) ?? message.match(/“([^”]+)”/);
  if (quoteMatch?.[1]) {
    const matched = findByTitle(tasks, quoteMatch[1]);
    if (!matched) return { kind: "none", reason: "not_found" };
    return { kind: "tasks", taskIds: [matched.id], source: "title" };
  }

  const ordinalIndex = getOrdinalIndex(lower);
  if (ordinalIndex !== null) {
    if (!listed.length) return { kind: "none", reason: "no_reference" };
    if (ordinalIndex === -1) {
      return { kind: "tasks", taskIds: [listed[listed.length - 1].id], source: "ordinal" };
    }
    if (!listed[ordinalIndex]) return { kind: "none", reason: "no_reference" };
    return { kind: "tasks", taskIds: [listed[ordinalIndex].id], source: "ordinal" };
  }

  if (/\b(it|that|this)\b/.test(lower) || /\b(that one|this one)\b/.test(lower)) {
    if (listed.length === 1) {
      return { kind: "tasks", taskIds: [listed[0].id], source: "pronoun" };
    }
    if (listed.length > 1) {
      return { kind: "clarify", options: listed.slice(0, 6) };
    }
    return { kind: "none", reason: "no_reference" };
  }

  return { kind: "none", reason: "no_reference" };
}
