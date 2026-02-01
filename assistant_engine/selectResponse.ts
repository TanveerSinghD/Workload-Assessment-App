import { getRecentIndexes, rememberResponse } from "./historyStore";
import { Intent, LibraryType, ResponseGroup, SelectedResponse, SelectionContext } from "./types";

const GENERIC_FALLBACKS = [
  "Here’s a solid plan: focus the next 30 minutes on the most urgent task, then one quick win.",
  "Let’s pick one priority, set a 25 minute timer, and start. I’ll keep you on track.",
  "Tackle the item closest to its due date, then reward yourself with a quick win.",
  "Start with a deep-focus block, then clear an easy item to keep momentum.",
  "Pick the hardest thing you can finish today, schedule it, then do a 10 minute tidy-up.",
  "Begin with the overdue item, then one medium task, then one easy cleanup.",
  "Choose the task with the biggest impact, set a timebox, and start immediately.",
  "Do a 5-minute prep, then a 40-minute focused sprint on your top task.",
  "Line up three items: overdue/urgent, deep-focus, quick win. Start in that order.",
  "Prioritize by impact and deadline: urgent first, then important, then quick wins.",
];

const GREETING_FALLBACKS = [
  "Hey! How can I help today?",
  "Hi there—what do you want to work on?",
  "Hello! Ready to plan something?",
  "Hey! Need help with tasks or schedule?",
  "Hi! What should we tackle?",
  "Hello! Want me to prioritize your tasks?",
  "Hey there 👋 what’s up?",
  "Hi—tell me what you’re working on.",
  "Hello! How can I assist?",
  "Hi! Need ideas on what to do next?",
];

function pickGroup(message: string, prefer: ResponseGroup | undefined, lib: LibraryType): ResponseGroup {
  if (prefer) return prefer;
  const lower = message.toLowerCase();
  if (/(quick|short|tl;dr)/.test(lower)) return "concise";
  if (/(step by step|how do i|explain|detail|help)/.test(lower)) return lib === "greet" ? "standard" : "detailed";
  if (lib === "main" && /(math|calculate|optimi[sz]e|estimate|solve)/.test(lower)) return "mathHeavy";
  if (/(motivate|struggling|stressed|encourage|stuck)/.test(lower)) return "coach";
  return "standard";
}

function pickVariant(responses: string[], recent: number[]): number {
  if (responses.length === 0) return -1;
  const available = responses
    .map((_, idx) => idx)
    .filter((idx) => !recent.includes(idx));
  if (available.length === 0) {
    return Math.floor(Math.random() * responses.length);
  }
  return available[Math.floor(Math.random() * available.length)];
}

export async function selectResponse(
  intent: Intent | null,
  context: SelectionContext
): Promise<SelectedResponse> {
  const group = pickGroup(context.userMessage, context.preferredGroup, context.library);

  const fallbacks = context.library === "greet" ? GREETING_FALLBACKS : GENERIC_FALLBACKS;

  if (!intent) {
    const idx = pickVariant(fallbacks, []);
    return { text: fallbacks[idx], group, index: idx, intentId: "fallback", library: context.library };
  }

  const bank = intent.responseBank;
  const responses =
    group === "concise"
      ? bank.concise
      : group === "detailed"
      ? bank.detailed
      : group === "coach"
      ? bank.coach || bank.standard
      : group === "mathHeavy"
      ? bank.mathHeavy || bank.standard
      : bank.standard;

  const safeResponses = responses && responses.length > 0 ? responses : bank.standard || fallbacks;
  const recent = await getRecentIndexes(context.library, intent.id);
  const idx = pickVariant(safeResponses, recent);
  await rememberResponse(context.library, intent.id, idx);

  return {
    text: safeResponses[idx] ?? GENERIC_FALLBACKS[0],
    group,
    index: idx,
    intentId: intent.id,
    library: context.library,
  };
}
