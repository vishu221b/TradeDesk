import { useEffect, useRef } from "react";
import { useChat } from "../context/ChatContext";
import type { ChatMode } from "../api/types";
import { MessageBubble } from "./MessageBubble";
import { Button } from "./ui";
import { Particles } from "./Particles";
import { Bolt, Chat as ChatIcon, Send, Spinner } from "./icons";

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
  const settings = { provider, model, mode };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

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
        {sending && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-accent">
            <Spinner className="h-3.5 w-3.5" /> Working…
          </span>
        )}
      </div>

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
              <MessageBubble key={m.id} message={m} />
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
