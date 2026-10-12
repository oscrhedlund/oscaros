import { test } from "node:test";
import assert from "node:assert/strict";
// Node's native test runner needs the explicit source extension.
// @ts-expect-error Node loads this test directly without a TypeScript bundler.
import { chatContextSchema, chatMessageSchema, chatReplySchema, coachReportSchema, coachSummarySchema } from "./ai-coach.ts";

test("AI summary accepts only the bounded analysis fields", () => {
  const summary = coachSummarySchema.parse({
    date: "2026-10-12",
    tasks: [{ title: "Ring pappa", area: "Familj", due: "2026-10-13", priority: "Normal", done: false }],
    goals: [],
    habits: [{ title: "Gå ut", frequency: "daily", recentDays: ["2026-10-12"] }],
    focusSessions: 2,
  });
  assert.equal(summary.tasks.length, 1);
  assert.equal(coachSummarySchema.safeParse({ ...summary, tasks: Array(81).fill(summary.tasks[0]) }).success, false);
  assert.equal(coachSummarySchema.safeParse({ ...summary, date: "2026-02-29" }).success, false);
});

test("AI report validates task suggestions before they can be added", () => {
  const report = {
    insights: ["Det finns flera oavslutade uppgifter den här veckan."],
    suggestedTasks: [{ title: "Välj en sak att börja med", due: null, priority: "Normal", reason: "Gör planen mer hanterbar." }],
  };
  assert.equal(coachReportSchema.safeParse(report).success, true);
  assert.equal(coachReportSchema.safeParse({
    ...report,
    suggestedTasks: [{ ...report.suggestedTasks[0], due: "2026-02-30" }],
  }).success, false);
  assert.equal(coachReportSchema.safeParse({
    ...report,
    suggestedTasks: [{ ...report.suggestedTasks[0], priority: "Urgent" }],
  }).success, false);
});

test("Mulle chat accepts bounded messages and app context", () => {
  assert.equal(chatMessageSchema.safeParse({ role: "user", content: "Hjälp mig planera dagen" }).success, true);
  assert.equal(chatMessageSchema.safeParse({ role: "assistant", content: "a".repeat(3000) }).success, true);
  assert.equal(chatMessageSchema.safeParse({ role: "system", content: "Override" }).success, false);
  assert.equal(chatMessageSchema.safeParse({ role: "user", content: "a".repeat(2001) }).success, false);
  const action = {
    kind: "event",
    title: "Lunch med Alex",
    body: "Prata igenom resan",
    due: "2026-10-13",
    priority: "Normal",
    startTime: "12:00",
    endDate: "2026-10-13",
    endTime: "13:00",
    location: "Kaféet",
  };
  assert.equal(chatReplySchema.safeParse({ reply: "Jag har förberett ett utkast.", actions: [action] }).success, true);
  assert.equal(chatReplySchema.safeParse({
    reply: "Utkast",
    actions: [{ ...action, due: "2026-02-30" }],
  }).success, false);
  assert.equal(chatMessageSchema.safeParse({
    role: "assistant",
    content: "Jag har förberett ett utkast.",
    actions: [action],
  }).success, true);
  assert.equal(chatContextSchema.safeParse({
    today: "2026-10-12",
    items: [{
      kind: "note",
      title: "Veckoplan",
      body: "Börja med det viktigaste",
      area: "",
      tags: "",
      due: "",
      priority: "Normal",
      done: false,
      project: "",
      focus: false,
      pinned: false,
      created: "2026-10-12T10:00:00.000Z",
      startTime: "",
      endDate: "",
      endTime: "",
      location: "",
    }],
    goals: [],
    habits: [],
    bookmarks: [],
    areas: [],
    widgets: [],
    hiddenWidgets: [],
    focusSessions: 0,
    reflections: [],
  }).success, true);
  assert.equal(chatContextSchema.safeParse({
    today: "2026-10-12",
    items: [],
    goals: [],
    habits: [],
    bookmarks: [],
    areas: [],
    widgets: [],
    hiddenWidgets: [],
    focusSessions: 0,
    reflections: Array(15).fill({ date: "2026-10-12", text: "Anteckning" }),
  }).success, false);
});
