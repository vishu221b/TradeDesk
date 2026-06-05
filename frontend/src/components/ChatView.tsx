import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "../context/ChatContext";
import type { ChatMode, ToolCall } from "../api/types";
import { MessageBubble } from "./MessageBubble";
import { ToolCallCard } from "./ToolCallCard";
import { Button } from "./ui";
import { Particles } from "./Particles";
import { Bolt, Chat as ChatIcon, Send, Spinner, Wrench } from "./icons";

interface ToolEntry {
  messageId: number;
  index: number;
  call: ToolCall;
}

const EXAMPLES = [
  "Which invoices are overdue, and draft a reminder for the worst one.",
  "What jobs are scheduled, and is anything high priority?",
  "Draft a quote for the Wilson garage job — ~16 hours labour and standard parts.",
  "Anything outstanding for Brookside Cafe?",
];

interface Props {
  provider: string;
  model: string;
  mode: ChatMode;
  setMode: (m: ChatMode) => void;
}

export function ChatView({ provider, model, mode, setMode }: Props) {
  const { activeKey, session, send, setInput } = useChat();
  const { messages, input, sending, error } = session(activeKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const settings = { provider, model, mode };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Flatten every tool call in the transcript, keeping a pointer back to the
  // message it came from so the panel can scroll/highlight the exact turn.
  const toolEntries = useMemo<ToolEntry[]>(() => {
    const out: ToolEntry[] = [];
    for (const m of messages) {
      m.tool_calls?.forEach((call, index) => out.push({ messageId: m.id, index, call }));
    }
    return out;
  }, [messages]);

  const scrollToMessage = (id: number) => {
    const el = scrollRef.current?.querySelector(`[data-mid="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(id);
    window.setTimeout(() => setHighlight((h) => (h === id ? null : h)), 1600);
  };

  const submit = () => send(activeKey, input, settings);
  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Mode toggle lives at the top of the chat. */}
      <div className="flex items-center gap-3 border-b border-edge-light px-4 py-2.5 dark:border-edge-dark md:px-8">
        <ModeToggle mode={mode} setMode={setMode} />
        <p className="hidden text-xs text-gray-500 dark:text-gray-400 sm:block">
          {mode === "agent"
            ? "Calls tools against your live data to answer and draft."
            : "Plain conversation — switch to Agent for live data."}
        </p>
        <div className="ml-auto flex items-center gap-3">
          {sending && (
            <span className="flex items-center gap-1.5 text-xs text-accent">
              <Spinner className="h-3.5 w-3.5" /> Working…
            </span>
          )}
          <button
            onClick={() => setToolsOpen((o) => !o)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              toolsOpen
                ? "border-accent bg-accent/10 text-accent"
                : "border-edge-light text-gray-500 hover:text-accent dark:border-edge-dark"
            }`}
            title="Toggle the tool-call panel"
          >
            <Wrench className="h-3.5 w-3.5" /> Tools
            {toolEntries.length > 0 && (
              <span className="rounded-full bg-accent/15 px-1.5 text-[10px] font-semibold text-accent">
                {toolEntries.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
      {/* transcript */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {empty ? (
          <div className="relative mx-auto mt-6 max-w-2xl text-center">
            <Particles quantity={28} className="-z-0" />
            <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow motion-safe:animate-float">
              <Bolt className="h-7 w-7" />
            </div>
            <h2 className="relative text-xl font-semibold">
              How can I help with the <span className="brand-text">job desk</span>?
            </h2>
            <p className="relative mt-1 text-sm text-gray-500 dark:text-gray-400">
              {mode === "agent"
                ? "Agent mode: I'll call tools against your data to answer and draft."
                : "Chat mode: a plain conversation — switch to Agent mode for live data."}
            </p>
            <div className="relative mt-6 grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(activeKey, ex, settings)}
                  className="card px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-glow"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                showToolCalls={!toolsOpen}
                highlight={highlight === m.id}
              />
            ))}
            {sending && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-[10px] font-bold text-white motion-safe:animate-pulse-glow">
                  AI
                </div>
                <div className="glass flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm text-gray-500 dark:text-gray-300">
                  <span className="flex gap-1">
                    <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
                  </span>
                  Thinking{mode === "agent" ? " & calling tools" : ""}…
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-edge-light px-4 py-3 dark:border-edge-dark md:px-8">
        <div className="mx-auto max-w-3xl">
          {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="card flex items-end gap-2 p-2 focus-within:border-accent focus-within:shadow-glow"
          >
            <textarea
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
              placeholder={mode === "agent" ? "Ask about jobs, invoices, quotes…" : "Chat about anything…"}
              rows={1}
              value={input}
              onChange={(e) => setInput(activeKey, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button type="submit" disabled={!input.trim()} className="px-3" aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-1.5 text-center text-[11px] text-gray-400">
            Quotes and messages are saved as drafts for you to review — nothing is ever sent.
          </p>
        </div>
      </div>
        </div>

        {toolsOpen && (
          <ToolPanel
            entries={toolEntries}
            onClose={() => setToolsOpen(false)}
            onJump={scrollToMessage}
          />
        )}
      </div>
    </div>
  );
}

function ToolPanel({
  entries,
  onClose,
  onJump,
}: {
  entries: ToolEntry[];
  onClose: () => void;
  onJump: (messageId: number) => void;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-edge-light bg-panel-light dark:border-edge-dark dark:bg-panel-dark/60 md:w-80">
      <div className="flex items-center gap-2 border-b border-edge-light px-4 py-2.5 dark:border-edge-dark">
        <Wrench className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold">Tool calls</span>
        <span className="text-xs text-gray-400">({entries.length})</span>
        <button onClick={onClose} className="btn-ghost ml-auto px-2 py-1 text-xs" aria-label="Close tool panel">
          ✕
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-gray-400">
            No tool calls yet. Ask the agent something in Agent mode.
          </p>
        ) : (
          entries.map((e, i) => (
            <div key={`${e.messageId}-${e.index}`} className="space-y-1.5">
              <button
                onClick={() => onJump(e.messageId)}
                className="flex w-full items-center gap-1.5 text-left text-[11px] text-gray-400 hover:text-accent"
                title="Jump to the message that triggered this call"
              >
                <span className="font-mono">#{i + 1}</span>
                <span className="truncate">jump to message ↗</span>
              </button>
              <ToolCallCard call={e.call} />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}

function ModeToggle({ mode, setMode }: { mode: ChatMode; setMode: (m: ChatMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-edge-light p-0.5 text-xs dark:border-edge-dark">
      <button
        onClick={() => setMode("agent")}
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
          mode === "agent" ? "bg-accent text-white shadow-glow" : "text-gray-500 hover:text-accent"
        }`}
      >
        <Bolt className="h-3.5 w-3.5" /> Agent
      </button>
      <button
        onClick={() => setMode("chat")}
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
          mode === "chat" ? "bg-accent text-white shadow-glow" : "text-gray-500 hover:text-accent"
        }`}
      >
        <ChatIcon className="h-3.5 w-3.5" /> Chat
      </button>
    </div>
  );
}
