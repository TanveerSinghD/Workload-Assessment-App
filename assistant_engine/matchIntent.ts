import { Intent, MatchCandidate, MatchResult } from "./types";

const TOKEN_REGEX = /[a-z0-9]+/gi;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(TOKEN_REGEX) || []).map((t) => t.trim()).filter(Boolean);
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
    exampleTokens.some((et) => et.startsWith(ut.slice(0, Math.min(3, ut.length))))
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
    // Small bump if category keyword appears.
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
