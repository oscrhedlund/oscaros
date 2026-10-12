import { z } from "zod";

const shortText = z.string().max(180);
const isoDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const date = isoDate.or(z.literal(""));

export const coachSummarySchema = z.object({
  date: date,
  tasks: z.array(z.object({
    title: shortText,
    area: z.string().max(80),
    due: date,
    priority: z.enum(["Low", "Normal", "High"]),
    done: z.boolean(),
  })).max(80),
  goals: z.array(z.object({
    title: shortText,
    description: z.string().max(300),
    area: z.string().max(80),
    target: date,
    progress: z.number().min(0).max(100),
  })).max(30),
  habits: z.array(z.object({
    title: shortText,
    frequency: z.enum(["daily", "weekly"]),
    recentDays: z.array(date).max(14),
  })).max(30),
  focusSessions: z.number().int().min(0).max(10000),
});

export const coachReportSchema = z.object({
  insights: z.array(z.string().min(1).max(400)).min(1).max(4),
  suggestedTasks: z.array(z.object({
    title: z.string().min(1).max(160),
    due: date.nullable(),
    priority: z.enum(["Low", "Normal", "High"]),
    reason: z.string().min(1).max(240),
  })).max(3),
});

export const chatContextSchema = z.object({
  today: date,
  items: z.array(z.object({
    kind: z.enum(["task", "note", "idea", "bookmark", "event", "reminder", "wishlist", "capture"]),
    title: z.string().max(180),
    body: z.string().max(1000),
    area: z.string().max(80),
    tags: z.string().max(300),
    due: date,
    priority: z.string().max(40),
    done: z.boolean(),
    project: z.string().max(100),
    focus: z.boolean(),
    pinned: z.boolean(),
    created: z.string().max(40),
    startTime: z.string().max(20),
    endDate: date,
    endTime: z.string().max(20),
    location: z.string().max(180),
  })).max(60),
  goals: z.array(z.object({
    title: z.string().max(180),
    description: z.string().max(500),
    area: z.string().max(80),
    target: date,
    progress: z.number().min(0).max(100),
  })).max(30),
  habits: z.array(z.object({
    title: z.string().max(180),
    frequency: z.enum(["daily", "weekly"]),
    recentDays: z.array(date).max(14),
  })).max(30),
  bookmarks: z.array(z.object({
    title: z.string().max(180),
    url: z.string().max(2048),
  })).max(50),
  areas: z.array(z.string().max(80)).max(30),
  widgets: z.array(z.string().max(40)).max(30),
  hiddenWidgets: z.array(z.string().max(40)).max(30),
  focusSessions: z.number().int().min(0).max(10000),
  reflections: z.array(z.object({
    date: date,
    text: z.string().max(1000),
  })).max(14),
});

export const chatMessageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().min(1).max(2000) }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().min(1).max(6000),
    actions: z.array(z.object({
      kind: z.enum(["task", "note", "event", "reminder"]),
      title: z.string().min(1).max(180),
      body: z.string().max(1000),
      due: date,
      priority: z.enum(["Low", "Normal", "High"]),
      startTime: z.string().max(5),
      endDate: date,
      endTime: z.string().max(5),
      location: z.string().max(180),
    })).max(3).optional(),
  }),
]);

export const chatReplySchema = z.object({
  reply: z.string().min(1).max(6000),
  actions: z.array(z.object({
    kind: z.enum(["task", "note", "event", "reminder"]),
    title: z.string().min(1).max(180),
    body: z.string().max(1000),
    due: date,
    priority: z.enum(["Low", "Normal", "High"]),
    startTime: z.string().max(5),
    endDate: date,
    endTime: z.string().max(5),
    location: z.string().max(180),
  })).max(3),
});

export type CoachSummary = z.infer<typeof coachSummarySchema>;
export type CoachReport = z.infer<typeof coachReportSchema>;
export type SuggestedTask = CoachReport["suggestedTasks"][number];
export type ChatContext = z.infer<typeof chatContextSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatAction = z.infer<typeof chatReplySchema>["actions"][number];
