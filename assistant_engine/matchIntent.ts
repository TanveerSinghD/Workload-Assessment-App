import { Intent, MatchCandidate, MatchResult } from "./types";

const TOKEN_REGEX = /[a-z0-9]+/gi;

// Synonym/stem map: normalises user vocabulary to canonical intent tokens.
// Handles academic synonyms (assignment→task), British spelling, common verbs.
const SYNONYM_MAP: Record<string, string> = {
  // task
  assignment: "task", assignments: "task", homework: "task",
  coursework: "task", items: "task", item: "task",
  todo: "task", todos: "task",
  // schedule/plan
  scheduling: "schedule", scheduled: "schedule",
  planner: "plan", planning: "plan", plans: "plan",
  organised: "organize", organise: "organize",
  // deadline
  deadlines: "deadline", duedate: "deadline",
  // priority
  priorities: "priority", prioritise: "priority", prioritize: "priority",
  urgent: "priority", critical: "priority", important: "priority",
  // study/review
  revise: "study", revision: "study", revising: "study",
  reviewing: "study", practise: "study", practice: "study",
  // complete
  finish: "complete", finished: "complete", done: "complete",
  completing: "complete", completed: "complete",
  tick: "complete", ticked: "complete", checked: "complete",
  mark: "complete",
  // overdue
  late: "overdue", missed: "overdue", behind: "overdue",
  // move
  push: "move", shift: "move", reschedule: "move", rescheduling: "move",
  defer: "move", delay: "move", postpone: "move",
  // show
  display: "show", see: "show", view: "show",
  tell: "show", give: "show",
  // start
  begin: "start", tackle: "start", focus: "start",
  // add/create
  create: "add", creating: "add", adding: "add", make: "add",
  // help
  assist: "help", support: "help", struggling: "help", stuck: "help",
  // exam
  exams: "exam", test: "exam", tests: "exam", quiz: "exam", quizzes: "exam",
  // subject
  module: "subject", modules: "subject", course: "subject",
  courses: "subject", lecture: "subject", lectures: "subject",
  // effort
  effort: "difficulty", difficult: "difficult",
  // time
  tonight: "today", asap: "urgent", immediately: "urgent",
};

function stem(token: string): string {
  const syn = SYNONYM_MAP[token];
  if (syn) return syn;
  // Lightweight suffix stripping for common English inflections
  if (token.length > 6) {
    if (token.endsWith("ing")) return token.slice(0, -3);
    if (token.endsWith("tion")) return token.slice(0, -4);
    if (token.endsWith("ness")) return token.slice(0, -4);
    if (token.endsWith("ment")) return token.slice(0, -4);
    if (token.endsWith("ed")) return token.slice(0, -2);
    if (token.endsWith("ly")) return token.slice(0, -2);
    if (token.endsWith("er")) return token.slice(0, -2);
    if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  }
  return token;
}

function tokenize(text: string): string[] {
  const raw = (text.toLowerCase().match(TOKEN_REGEX) || []).filter((t) => t.length > 0);
  // Include both raw and stemmed tokens — exact matches still score, synonyms now also match
  const expanded = new Set<string>();
  raw.forEach((t) => {
    expanded.add(t);
    expanded.add(stem(t));
  });
  return Array.from(expanded);
}

function jaccardScore(a: string[], b: string[]) {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  return intersection / union;
}

function prefixBonus(userTokens: string[], exampleTokens: string[]) {
  const bonusHit = userTokens.some((ut) =>
    exampleTokens.some((et) => et.startsWith(ut.slice(0, Math.min(4, ut.length))))
  );
  return bonusHit ? 0.05 : 0;
}

function scoreExample(userTokens: string[], example: string) {
  const exampleTokens = tokenize(example);
  if (exampleTokens.length === 0) return 0;
  const jaccard = jaccardScore(userTokens, exampleTokens);
  const overlap = exampleTokens.filter((t) => userTokens.includes(t)).length;
  const density = overlap / exampleTokens.length;
  return jaccard * 0.6 + density * 0.35 + prefixBonus(userTokens, exampleTokens);
}

export function matchIntent(userMessage: string, intents: Intent[], minScore = 0.1): MatchResult {
  const userTokens = tokenize(userMessage);
  if (userTokens.length === 0 || intents.length === 0) {
    return { top: null, top3: [] };
  }

  const candidates: MatchCandidate[] = intents.map((intent) => {
    const bestExampleScore = intent.userPromptExamples.reduce(
      (max, ex) => Math.max(max, scoreExample(userTokens, ex)),
      0
    );
    const categoryBonus =
      intent.category && userMessage.toLowerCase().includes(intent.category.toLowerCase()) ? 0.05 : 0;
    const score = bestExampleScore + categoryBonus;
    return { intent, score };
  });

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0] && candidates[0].score >= minScore ? candidates[0] : null;
  const top3 = candidates.slice(0, 3);
  return { top, top3 };
}
