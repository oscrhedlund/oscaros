"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Bot, CalendarDays, LoaderCircle, ListTodo, NotebookPen, Plus, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import { day, offset, type Bookmark, type Goal, type Habit, type Item } from "@/lib/personal-data";
import {
  chatMessageSchema,
  chatReplySchema,
  coachReportSchema,
  type ChatAction,
  type ChatContext,
  type ChatMessage,
  type CoachReport,
  type CoachSummary,
  type SuggestedTask,
} from "@/lib/ai-coach";

const storageKey = "personal-os-ai-v1";
const chatStorageKey = "personal-os-piff-chat-v1";
type Preferences = {
  dailyAutomation: boolean;
  lastAnalyzed: string;
  report: CoachReport | null;
};

const initialPreferences: Preferences = {
  dailyAutomation: false,
  lastAnalyzed: "",
  report: null,
};

function isPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Preferences>;
  return typeof candidate.dailyAutomation === "boolean" &&
    typeof candidate.lastAnalyzed === "string" &&
    (candidate.report === null || coachReportSchema.safeParse(candidate.report).success);
}

function readPreferences(): { preferences: Preferences; error: string } {
  if (typeof window === "undefined") return { preferences: initialPreferences, error: "" };
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return { preferences: initialPreferences, error: "" };
    const parsed: unknown = JSON.parse(saved);
    if (!isPreferences(parsed)) throw new Error("AI-inställningarna har ett ogiltigt format.");
    return {
      preferences: {
        dailyAutomation: parsed.dailyAutomation,
        lastAnalyzed: parsed.lastAnalyzed,
        report: parsed.report,
      },
      error: "",
    };
  } catch (cause) {
    return {
      preferences: initialPreferences,
      error: cause instanceof Error ? cause.message : "AI-inställningarna kunde inte läsas.",
    };
  }
}

function readChatHistory() {
  if (typeof window === "undefined") return { messages: [] as ChatMessage[], error: "" };
  try {
    const saved = localStorage.getItem(chatStorageKey);
    if (!saved) return { messages: [] as ChatMessage[], error: "" };
    const parsed: unknown = JSON.parse(saved);
    const messages = chatMessageSchema.array().max(30).safeParse(parsed);
    if (!messages.success) throw new Error("Den sparade chatthistoriken har ett ogiltigt format.");
    return { messages: messages.data, error: "" };
  } catch (cause) {
    return {
      messages: [] as ChatMessage[],
      error: cause instanceof Error ? cause.message : "Chatthistoriken kunde inte läsas.",
    };
  }
}

type Props = {
  items: Item[];
  goals: Goal[];
  habits: Habit[];
  bookmarks: Bookmark[];
  areas: string[];
  widgets: string[];
  hiddenWidgets: string[];
  reflections: Record<string, string>;
  focusSessions: number;
  onAddTask: (task: SuggestedTask) => void;
  onCreateItem: (action: ChatAction) => void;
  compact?: boolean;
  hidden?: boolean;
};

export function AICoach({
  items,
  goals,
  habits,
  bookmarks,
  areas,
  widgets,
  hiddenWidgets,
  reflections,
  focusSessions,
  onAddTask,
  onCreateItem,
  compact = false,
  hidden = false,
}: Props) {
  const [savedSettings] = useState(readPreferences);
  const [savedChat] = useState(readChatHistory);
  const [preferences, setPreferences] = useState(savedSettings.preferences);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(savedChat.messages);
  const [chatLoaded, setChatLoaded] = useState(false);
  const visibleChatMessages = chatLoaded ? chatMessages : [];
  const [today, setToday] = useState(day());
  const [error, setError] = useState(savedSettings.error || savedChat.error);
  const attemptedDate = useRef("");
  const preferencesRef = useRef(savedSettings.preferences);
  const chatMessagesRef = useRef(savedChat.messages);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const summary = useMemo<CoachSummary>(() => ({
    date: today,
    tasks: items.filter((item) => item.kind === "task").slice(0, 80).map((item) => ({
      title: item.title.slice(0, 180),
      area: item.area.slice(0, 80),
      due: item.due,
      priority: item.priority === "Low" || item.priority === "High" ? item.priority : "Normal",
      done: item.done,
    })),
    goals: goals.slice(0, 30).map((goal) => ({
      title: goal.title.slice(0, 180),
      description: goal.description.slice(0, 300),
      area: goal.area.slice(0, 80),
      target: goal.target,
      progress: goal.progress,
    })),
    habits: habits.slice(0, 30).map((habit) => ({
      title: habit.title.slice(0, 180),
      frequency: habit.frequency,
      recentDays: habit.days.filter((date) => date >= offset(-13) && date <= today).slice(-14),
    })),
    focusSessions,
  }), [focusSessions, goals, habits, items, today]);

  const chatContext = useMemo<ChatContext>(() => ({
    today,
    items: items.slice(0, 60).map((item) => ({
      kind: item.kind,
      title: item.title.slice(0, 180),
      body: item.body.slice(0, 1000),
      area: item.area.slice(0, 80),
      tags: item.tags.slice(0, 300),
      due: item.due,
      priority: item.priority.slice(0, 40),
      done: item.done,
      project: item.project.slice(0, 100),
      focus: item.focus,
      pinned: item.pinned,
      created: item.created.slice(0, 40),
      startTime: item.startTime || "",
      endDate: item.endDate || "",
      endTime: item.endTime || "",
      location: item.location || "",
    })),
    goals: goals.slice(0, 30).map((goal) => ({
      title: goal.title.slice(0, 180),
      description: goal.description.slice(0, 500),
      area: goal.area.slice(0, 80),
      target: goal.target,
      progress: goal.progress,
    })),
    habits: habits.slice(0, 30).map((habit) => ({
      title: habit.title.slice(0, 180),
      frequency: habit.frequency,
      recentDays: habit.days.filter((date) => date >= offset(-13) && date <= today).slice(-14),
    })),
    bookmarks: bookmarks.slice(0, 50).map((bookmark) => ({
      title: bookmark.title.slice(0, 180),
      url: bookmark.url.slice(0, 2048),
    })),
    areas: areas.slice(0, 30).map((area) => area.slice(0, 80)),
    widgets: widgets.slice(0, 30),
    hiddenWidgets: hiddenWidgets.slice(0, 30),
    focusSessions,
    reflections: Object.entries(reflections)
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, 14)
      .map(([date, text]) => ({ date, text: text.slice(0, 1000) })),
  }), [areas, bookmarks, focusSessions, goals, habits, hiddenWidgets, items, reflections, today, widgets]);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(day()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setChatLoaded(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updateChatMessages = useCallback((update: (current: ChatMessage[]) => ChatMessage[]) => {
    const next = update(chatMessagesRef.current).slice(-30);
    chatMessagesRef.current = next;
    setChatMessages(next);
    if (!chatLoaded) return;
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(next));
    } catch {
      setError("Chatten kunde inte sparas i den här webbläsaren.");
    }
  }, [chatLoaded]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, chatBusy]);

  const updatePreferences = useCallback((update: (current: Preferences) => Preferences) => {
    const next = update(preferencesRef.current);
    preferencesRef.current = next;
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setError("AI-inställningarna kunde inte sparas i den här webbläsaren.");
    }
  }, []);

  const runAnalysis = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "analysis", summary }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result &&
          typeof result.error === "string" ? result.error : "AI-analysen misslyckades.";
        throw new Error(message);
      }
      const parsed = result && typeof result === "object" && "report" in result
        ? coachReportSchema.safeParse(result.report)
        : null;
      if (!parsed?.success) throw new Error("AI-tjänstens analys hade ett oväntat format.");
      updatePreferences((current) => ({ ...current, report: parsed.data, lastAnalyzed: today }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI-analysen kunde inte slutföras.");
    } finally {
      setBusy(false);
    }
  }, [busy, summary, today, updatePreferences]);

  useEffect(() => {
    if (!preferences.dailyAutomation ||
      preferences.lastAnalyzed === today || attemptedDate.current === today) return;
    attemptedDate.current = today;
    void runAnalysis();
  }, [preferences.dailyAutomation, preferences.lastAnalyzed, runAnalysis, today]);

  async function sendMessage(message = chatInput) {
    const trimmed = message.trim();
    if (!trimmed || !chatLoaded || chatBusy) return;
    setChatInput("");
    setError("");
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    updateChatMessages((current) => [...current, userMessage]);
    setChatBusy(true);
    try {
      const response = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          message: trimmed,
          history: chatMessagesRef.current.slice(0, -1).slice(-12),
          context: chatContext,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result &&
          typeof result.error === "string" ? result.error : "Mulle kunde inte svara just nu.";
        throw new Error(message);
      }
      const parsedReply = chatReplySchema.safeParse(result);
      if (!parsedReply.success) {
        throw new Error("Mulles svar hade ett oväntat format.");
      }
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: parsedReply.data.reply.trim(),
        actions: parsedReply.data.actions,
      };
      updateChatMessages((current) => [...current, assistantMessage]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Meddelandet kunde inte skickas.");
    } finally {
      setChatBusy(false);
    }
  }

  const report = preferences.report;

  return (
    <section hidden={hidden} className={`widget ai-coach${compact ? " ai-coach-compact" : ""}`}>
      <div className="widget-heading ai-coach-heading">
        <h2><Sparkles size={18} /> Mulle</h2>
      </div>
      <p className="muted ai-intro">Din kompis med koll på appen — fråga, planera eller be om ett utkast.</p>

      <div className="ai-chat" aria-label="Chatt med Mulle">
        <div className="ai-chat-heading">
          <span className="ai-chat-avatar"><Bot size={19} /></span>
          <span><strong>Mulle</strong><small>Din kompis med koll på appen</small></span>
          {visibleChatMessages.length > 0 && (
            <button
              type="button"
              className="icon-button ai-clear"
              aria-label="Rensa chatthistoriken"
              disabled={!chatLoaded || chatBusy}
              onClick={() => updateChatMessages(() => [])}
            ><Trash2 size={15} /></button>
          )}
        </div>
        <div className="ai-chat-transcript" aria-live="polite" aria-relevant="additions text">
          {visibleChatMessages.length === 0 && (
            <div className="ai-chat-welcome">
              <strong>Hej! Jag är Mulle 👋</strong>
              <p>Jag kan hjälpa dig få koll på din plan, förstå appens funktioner eller hitta ett lagom nästa steg. Vad funderar du på?</p>
              <div className="ai-chat-prompts">
                {["Vad borde jag fokusera på idag?", "Hur går det med mina mål?", "Hur kan jag använda appen bättre?"].map((prompt) => (
                  <button key={prompt} type="button" className="secondary small" disabled={!chatLoaded || chatBusy} onClick={() => void sendMessage(prompt)}>{prompt}</button>
                ))}
              </div>
            </div>
          )}
          {visibleChatMessages.map((message, index) => (
            <div className={`ai-chat-entry ai-chat-entry-${message.role}`} key={`${index}-${message.role}`}>
            <div className={`ai-chat-message ai-chat-${message.role}`}>
              <span className="ai-chat-message-avatar" aria-hidden="true">{message.role === "assistant" ? <Bot size={15} /> : <UserRound size={15} />}</span>
              <p>{message.content}</p>
            </div>
            {message.role === "assistant" && message.actions?.map((action, actionIndex) => {
              const ActionIcon = action.kind === "task" ? ListTodo : action.kind === "note" ? NotebookPen : action.kind === "event" ? CalendarDays : Bell;
              const actionLabel = action.kind === "task" ? "uppgift" : action.kind === "note" ? "anteckning" : action.kind === "event" ? "kalenderpost" : "påminnelse";
              return (
                <div className="ai-chat-action" key={`${action.kind}-${action.title}-${actionIndex}`}>
                  <span><ActionIcon size={16} /><strong>{action.title}</strong></span>
                  {action.body && <small>{action.body}</small>}
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => {
                      onCreateItem(action);
                      updateChatMessages((current) => current.map((entry, entryIndex) =>
                        entryIndex === index && entry.role === "assistant"
                          ? { ...entry, actions: entry.actions?.filter((_, indexToKeep) => indexToKeep !== actionIndex) }
                          : entry,
                      ));
                    }}
                  >Granska {actionLabel}</button>
                </div>
              );
            })}
            </div>
          ))}
          {chatBusy && <div className="ai-chat-typing"><LoaderCircle className="ai-spinner" size={15} /> Mulle funderar…</div>}
          <div ref={chatEndRef} />
        </div>
        <form className="ai-chat-form" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <textarea
            aria-label="Skriv ett meddelande till Mulle"
            placeholder="Skriv till din appkompis…"
            value={chatInput}
            maxLength={2000}
            disabled={!chatLoaded || chatBusy}
            rows={2}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
          />
          <button className="primary ai-chat-send" type="submit" aria-label="Skicka meddelande" disabled={!chatLoaded || chatBusy || !chatInput.trim()}>
            {chatBusy ? <LoaderCircle className="ai-spinner" size={17} /> : <Send size={17} />}
          </button>
        </form>
        <p className="ai-chat-hint">Enter skickar · Shift + Enter gör en ny rad</p>
      </div>

      {error && <p role="alert" className="ai-error">{error}</p>}

      <details className="ai-analysis-tools">
        <summary><Sparkles size={15} /> Dagsanalys och automation</summary>
        <p className="muted">Låt Mulle hitta mönster i uppgifter, mål och vanor och föreslå små nästa steg.</p>
        <div className="ai-actions">
          <button className="primary" type="button" disabled={busy} onClick={() => void runAnalysis()}>
            {busy ? <LoaderCircle className="ai-spinner" size={16} /> : <Sparkles size={16} />}
            {busy ? "Analyserar…" : "Analysera min plan"}
          </button>
          <span className="ai-last-run">
            {preferences.lastAnalyzed === today ? "Analyserad idag" : preferences.lastAnalyzed ? `Senast ${preferences.lastAnalyzed}` : "Ingen analys ännu"}
          </span>
        </div>
        <label className="ai-automation">
          <input
            type="checkbox"
            checked={preferences.dailyAutomation}
            disabled={busy || chatBusy}
            onChange={(event) => updatePreferences((current) => ({ ...current, dailyAutomation: event.target.checked }))}
          />
          <span>Automatisk dagsanalys medan appen är öppen</span>
        </label>
        {report && (
          <div className="ai-report" aria-live="polite">
            <div className="ai-report-title">
              <h3><Bot size={17} /> Det här ser Mulle</h3>
              <button type="button" className="icon-button ai-clear" aria-label="Rensa sparad AI-analys" onClick={() => updatePreferences((current) => ({ ...current, report: null }))}>
                <Trash2 size={15} />
              </button>
            </div>
            <ul>{report.insights.map((insight, index) => <li key={`${index}-${insight}`}>{insight}</li>)}</ul>
            {report.suggestedTasks.length > 0 && (
              <div className="ai-suggestions">
                <h3>Små nästa steg</h3>
                {report.suggestedTasks.map((task, index) => (
                  <div className="ai-suggestion" key={`${index}-${task.title}`}>
                    <span><strong>{task.title}</strong><small>{task.reason}{task.due ? ` · ${task.due}` : ""}</small></span>
                    <button className="secondary small" type="button" onClick={() => onAddTask(task)}><Plus size={14} /> Lägg till</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </details>
    </section>
  );
}
