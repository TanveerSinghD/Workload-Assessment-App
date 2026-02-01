import { getLibraries, isGreetingMessage, matchIntent, selectResponse } from "../assistant_engine";

async function run() {
  const libs = await getLibraries();
  if (!libs.main.length && !libs.greetings.length) {
    console.log("No libraries loaded.");
    return;
  }

  const samples = [
    "hi",
    "hello there",
    "hey 👋",
    "good morning",
    "yo!",
    "hi can you plan my week",
    "hello can you fix my schedule",
    "hey need help with tasks",
    "hi how do I study",
    "hello can you calculate 5+5",
    "plan my study week for exams",
    "show me easy tasks",
    "optimize schedule tomorrow",
    "math: calculate 12*4+3",
    "motivate me to start homework",
  ];

  for (const prompt of samples) {
    const isGreet = isGreetingMessage(prompt);
    const pool = isGreet ? libs.greetings : libs.main;
    const match = matchIntent(prompt, pool);
    const selection = await selectResponse(match.top?.intent ?? null, {
      userMessage: prompt,
      library: isGreet ? "greet" : "main",
    });
    console.log("----");
    console.log("Prompt:", prompt);
    console.log("Library:", isGreet ? "greet" : "main");
    console.log("Intent:", match.top?.intent?.id ?? "fallback", "Score:", match.top?.score?.toFixed(3));
    console.log("Group:", selection.group, "Text:", selection.text.slice(0, 120));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
