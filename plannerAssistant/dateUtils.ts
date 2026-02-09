type Granularity = "day" | "week" | "month";

export type ParsedDateQuery = {
  type: "day" | "range";
  startISO: string;
  endISO: string;
  granularity: Granularity;
  confidence: "high" | "medium" | "low";
  sourceText?: string;
};

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const ORDINAL = "(?:st|nd|rd|th)?";
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

export function toISODateLocal(date: Date): string {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const tzAdjusted = new Date(copy.getTime() - copy.getTimezoneOffset() * 60000);
  return tzAdjusted.toISOString().slice(0, 10);
}

function startOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function endOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

function parseRelativeDays(text: string, now: Date): ParsedDateQuery | null {
  if (/today/.test(text)) {
    const iso = toISODateLocal(now);
    return { type: "day", startISO: iso, endISO: iso, granularity: "day", confidence: "high" };
  }
  if (/tomorrow/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    const iso = toISODateLocal(d);
    return { type: "day", startISO: iso, endISO: iso, granularity: "day", confidence: "high" };
  }

  const relMatch = text.match(/\b(in|from)\s+(\d+)\s+(day|days|week|weeks)\b/);
  if (relMatch) {
    const count = Number(relMatch[2]);
    const unit = relMatch[3];
    const offset = unit.startsWith("week") ? count * 7 : count;
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const iso = toISODateLocal(d);
    return { type: "day", startISO: iso, endISO: iso, granularity: "day", confidence: "high" };
  }

  const weeksToday = text.match(/(\d+)\s+weeks?.*(from\s+)?today/);
  if (weeksToday) {
    const offset = Number(weeksToday[1]) * 7;
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const iso = toISODateLocal(d);
    return { type: "day", startISO: iso, endISO: iso, granularity: "day", confidence: "high" };
  }

  return null;
}

function parseWeekday(text: string, now: Date): ParsedDateQuery | null {
  const weekdayMatch = text.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/
  );
  if (!weekdayMatch) return null;
  const target = WEEKDAYS[weekdayMatch[1]];
  if (target === undefined) return null;

  const currentDow = now.getDay();
  const diff = (target - currentDow + 7) % 7;
  const offset = diff === 0 ? 7 : diff; // always next occurrence to avoid ambiguity with today
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  const iso = toISODateLocal(d);
  return { type: "day", startISO: iso, endISO: iso, granularity: "day", confidence: "medium" };
}

function parseDayMonth(text: string, now: Date): ParsedDateQuery | null {
  const dayMonth = text.match(new RegExp(`\\b(\\d{1,2})${ORDINAL}?\\s+(?:of\\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\\b`));
  const monthDay = text.match(new RegExp(`\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\\s+(\\d{1,2})${ORDINAL}?\\b`));

  const numeric = text.match(/\b(\d{1,2})[\/.-](\d{1,2})\b/);

  const nowYear = now.getFullYear();

  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const monthIndex = MONTHS[dayMonth[2]];
    const date = new Date(Date.UTC(nowYear, monthIndex, day));
    const iso = toISODateLocal(date);
    return { type: "day", startISO: iso, endISO: iso, granularity: "day", confidence: "medium" };
  }

  if (monthDay) {
    const day = Number(monthDay[2]);
    const monthIndex = MONTHS[monthDay[1]];
    const date = new Date(Date.UTC(nowYear, monthIndex, day));
    const iso = toISODateLocal(date);
    return { type: "day", startISO: iso, endISO: iso, granularity: "day", confidence: "medium" };
  }

  if (numeric) {
    const day = Number(numeric[1]);
    const monthIndex = Number(numeric[2]) - 1; // UK style DD/MM
    if (monthIndex >= 0 && monthIndex <= 11 && day >= 1 && day <= 31) {
      const date = new Date(Date.UTC(nowYear, monthIndex, day));
      const iso = toISODateLocal(date);
      return { type: "day", startISO: iso, endISO: iso, granularity: "day", confidence: "low" };
    }
  }

  return null;
}

function parseMonthRange(text: string, now: Date): ParsedDateQuery | null {
  const monthOnly = text.match(
    new RegExp(
      `\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)(?:\\s+(next year|this year|\\d{4}))?\\b`
    )
  );
  if (!monthOnly) return null;

  const monthIndex = MONTHS[monthOnly[1]];
  const yearPhrase = monthOnly[2];
  const baseYear = (() => {
    if (!yearPhrase) return now.getFullYear();
    if (yearPhrase === "next year") return now.getFullYear() + 1;
    if (yearPhrase === "this year") return now.getFullYear();
    const numericYear = Number(yearPhrase);
    return Number.isNaN(numericYear) ? now.getFullYear() : numericYear;
  })();

  const start = startOfMonth(baseYear, monthIndex);
  const end = endOfMonth(baseYear, monthIndex);
  const startISO = toISODateLocal(start);
  const endISO = toISODateLocal(end);
  return { type: "range", startISO, endISO, granularity: "month", confidence: "medium" };
}

export function parseDateQuery(userText: string, now = new Date(), timezone?: string): ParsedDateQuery | null {
  void timezone; // reserved for future timezone-aware parsing
  const text = userText.toLowerCase();

  const relative = parseRelativeDays(text, now);
  if (relative) return { ...relative, sourceText: userText };

  const weekday = parseWeekday(text, now);
  if (weekday) return { ...weekday, sourceText: userText };

  const dayMonth = parseDayMonth(text, now);
  if (dayMonth) return { ...dayMonth, sourceText: userText };

  const monthRange = parseMonthRange(text, now);
  if (monthRange) return { ...monthRange, sourceText: userText };

  return null;
}

export function formatISODate(iso: string, options: { withWeekday?: boolean } = {}) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: options.withWeekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return formatter.format(date);
}
