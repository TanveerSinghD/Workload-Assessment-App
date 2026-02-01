const GREETING_WORDS = [
  "hi",
  "hello",
  "hey",
  "hiya",
  "yo",
  "sup",
  "how are you",
  "how r u",
  "good morning",
  "good afternoon",
  "good evening",
  "morning",
  "evening",
  "hola",
  "bonjour",
  "hey there",
  "what's up",
  "whats up",
  "sup?",
  "👋",
];

const NON_GREETING_HINTS = ["can you", "help", "fix", "make", "build", "why", "how", "explain", "bug", "error"];

function normalize(text: string) {
  return text.trim().toLowerCase();
}

export function isGreetingMessage(message: string): boolean {
  const text = normalize(message);
  if (!text) return false;

  const words = text.split(/\s+/);
  if (words.length > 8) return false;

  const greetingHit = GREETING_WORDS.some((w) => text.includes(w));
  if (!greetingHit) return false;

  const nonGreeting = NON_GREETING_HINTS.some((w) => text.includes(w));
  if (nonGreeting) return false;

  return true;
}
