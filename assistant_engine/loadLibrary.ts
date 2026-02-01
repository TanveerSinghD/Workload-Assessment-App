import { Intent } from "./types";

let cachedIntents: Intent[] | null = null;

function isIntent(value: any): value is Intent {
  return (
    value &&
    typeof value.id === "string" &&
    Array.isArray(value.userPromptExamples) &&
    typeof value.responseBank === "object"
  );
}

export async function loadLibrary(): Promise<Intent[]> {
  if (cachedIntents) return cachedIntents;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw = require("../app/assistant_library_intents.json");
    if (!Array.isArray(raw)) throw new Error("Intent library is not an array");

    const validated = raw.filter(isIntent) as Intent[];
    cachedIntents = validated;
    return validated;
  } catch (error) {
    console.error("[assistant_engine] Failed to load intent library:", error);
    cachedIntents = [];
    return [];
  }
}

export function clearLibraryCache() {
  cachedIntents = null;
}
