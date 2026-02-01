import { Intent } from "./types";

let cachedMain: Intent[] | null = null;
let cachedGreet: Intent[] | null = null;

function isIntent(value: any): value is Intent {
  return (
    value &&
    typeof value.id === "string" &&
    Array.isArray(value.userPromptExamples) &&
    typeof value.responseBank === "object"
  );
}

export async function loadMainLibrary(): Promise<Intent[]> {
  if (cachedMain) return cachedMain;
  try {
    // Static require so Metro can bundle JSON
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw = require("../app/assistant_library_intents.json");
    if (!Array.isArray(raw)) throw new Error("Intent library is not an array");
    cachedMain = (raw as any[]).filter(isIntent) as Intent[];
  } catch (err) {
    console.error("[assistant_engine] Failed to load main library:", err);
    cachedMain = [];
  }
  return cachedMain;
}

export async function loadGreetingLibrary(): Promise<Intent[]> {
  if (cachedGreet) return cachedGreet;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw = require("../app/assistant_library_greetings.json");
    if (!Array.isArray(raw)) throw new Error("Greeting library is not an array");
    cachedGreet = (raw as any[]).filter(isIntent) as Intent[];
  } catch (err) {
    console.error("[assistant_engine] Failed to load greeting library:", err);
    cachedGreet = [];
  }
  return cachedGreet;
}

export async function getLibraries() {
  const [greetings, main] = await Promise.all([loadGreetingLibrary(), loadMainLibrary()]);
  return { greetings, main };
}

export function clearLibraryCaches() {
  cachedMain = null;
  cachedGreet = null;
}
