import assert from "node:assert/strict";
import {
  createConversationContext,
  extractDateRef,
  extractMoveTarget,
  resolveDateRef,
  updateContextForList,
} from "@/plannerAssistant/conversation";

function run() {
  const now = new Date("2026-03-05T09:00:00");

  // 1) Follow-up with day-only date should inherit month/year from prior asked/listed date.
  let context = createConversationContext(now);
  context = updateContextForList(context, "2026-03-05", [], "2026-03-05");
  const followUpRef = extractDateRef("What about the 8th?");
  const followUpISO = resolveDateRef(followUpRef, context, now);
  assert.equal(followUpISO, "2026-03-08");

  // 2) "that date" should fall back to lastActionDateISO after a move.
  context = createConversationContext(now);
  context.lastActionDateISO = "2026-03-10";
  context.lastAnchorDateISO = null;
  context.lastListedDateISO = "2026-03-08";
  const thatDateRef = extractDateRef("What about that date?");
  const thatDateISO = resolveDateRef(thatDateRef, context, now);
  assert.equal(thatDateISO, "2026-03-10");

  // 3) Ordinal move target should select from last listed tasks.
  context = createConversationContext(now);
  context.lastListedTasks = [
    { id: "t1", title: "Task One" },
    { id: "t2", title: "Task Two" },
    { id: "t3", title: "Task Three" },
  ];
  const secondTarget = extractMoveTarget("Move the second one to the 10th", context, [
    { id: "t1", title: "Task One" },
    { id: "t2", title: "Task Two" },
    { id: "t3", title: "Task Three" },
  ]);
  assert.equal(secondTarget.kind, "tasks");
  if (secondTarget.kind === "tasks") {
    assert.deepEqual(secondTarget.taskIds, ["t2"]);
  }

  // 4) Pronoun "it" should resolve when only one task was listed.
  context = createConversationContext(now);
  context.lastListedTasks = [{ id: "solo", title: "Only Task" }];
  const pronounTarget = extractMoveTarget("Move it to tomorrow", context, [{ id: "solo", title: "Only Task" }]);
  assert.equal(pronounTarget.kind, "tasks");
  if (pronounTarget.kind === "tasks") {
    assert.deepEqual(pronounTarget.taskIds, ["solo"]);
  }

  // 5) "Move them all to next week" should select all listed tasks and resolve destination date.
  context = createConversationContext(now);
  context.lastListedTasks = [
    { id: "a", title: "Alpha" },
    { id: "b", title: "Beta" },
    { id: "c", title: "Gamma" },
  ];
  const allTarget = extractMoveTarget("Move them all to next week", context, [
    { id: "a", title: "Alpha" },
    { id: "b", title: "Beta" },
    { id: "c", title: "Gamma" },
  ]);
  assert.equal(allTarget.kind, "tasks");
  if (allTarget.kind === "tasks") {
    assert.deepEqual(allTarget.taskIds, ["a", "b", "c"]);
  }

  const nextWeekRef = extractDateRef("Move them all to next week");
  const nextWeekISO = resolveDateRef(nextWeekRef, context, now);
  assert.equal(nextWeekISO, "2026-03-12");

  console.log("plannerAssistantDateContextTest: all assertions passed");
}

run();
