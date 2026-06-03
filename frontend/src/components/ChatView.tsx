import { useEffect, useRef, useState } from "react";
import { chatApi } from "../api/endpoints";
import { apiError } from "../api/client";
import type { ChatMessage, ChatMode } from "../api/types";
import { MessageBubble } from "./MessageBubble";
import { Button } from "./ui";
import { Bolt, Chat as ChatIcon, Send, Spinner } from "./icons";

const EXAMPLES = [
  "Which invoices are overdue, and draft a reminder for the worst one.",
  "What jobs are scheduled, and is anything high priority?",
  "Draft a quote for the Wilson garage job — ~16 hours labour and standard parts.",
  "Anything outstanding for Brookside Cafe?",
];

interface Props {
  conversationId: number | null;
  provider: string;
  model: string;
  mode: ChatMode;
  setMode: (m: ChatMode) => void;
  onConversationChange: (id: number) => void;
  onConversationsRefresh: () => void;
}

export function ChatView({
  conversationId,
  provider,
  model,
  mode,
  setMode,
  onConversationChange,
  onConversationsRefresh,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load (or clear) the transcript when the active conversation changes.
  useEffect(() => {
    setError("");
    if (conversationId == null) {
      setMessages([]);
      return;
    }
    chatApi
      .conversation(conversationId)
      .then((c) => setMessages(c.messages))
      .catch((e) => setError(apiError(e)));
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError("");
    setInput("");
    setSending(true);

    const optimistic: ChatMessage = { id: Date.now(), role: "user", content: trimmed, tool_calls: [] };
    setMessages((m) => [...m, optimistic]);

    try {
      const res = await chatApi.send({
        message: trimmed,
        provider,
        model: model || undefined,
        mode,
        conversation_id: conversationId ?? undefined,
      });
      setMessages((m) => [
        ...m,
        { id: res.conversation_id * -1 - Date.now(), role: "assistant", content: res.reply, tool_calls: res.tool_calls },
      ]);
      if (conversationId == null) {
        onConversationChange(res.conversation_id);
        onConversationsRefresh();
      } else {
        onConversationsRefresh();
      }
    } catch (e) {
      setError(apiError(e, "The agent could not complete that request."));
      setMessages((m) => m.filter((msg) => msg.id !== optimistic.id));
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {empty ? (
          <div className="mx-auto mt-6 max-w-2xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white">
              <Bolt className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold">How can I help with the job desk?</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {mode === "agent"
                ? "Agent mode: I'll call tools against your data to answer and draft."
                : "Chat mode: a plain conversation — switch to Agent mode for live data."}
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  className="card px-4 py-3 text-left text-sm transition hover:border-accent hover:shadow"
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
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Spinner className="h-4 w-4" /> Thinking{mode === "agent" ? " & calling tools" : ""}…
              </div>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-edge-light px-4 py-3 dark:border-edge-dark md:px-8">
        <div className="mx-auto max-w-3xl">
          {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
          <div className="mb-2 flex items-center gap-1">
            <ModeToggle mode={mode} setMode={setMode} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="card flex items-end gap-2 p-2"
          >
            <textarea
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
              placeholder={mode === "agent" ? "Ask about jobs, invoices, quotes…" : "Chat about anything…"}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <Button type="submit" loading={sending} disabled={!input.trim()} className="px-3" aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: ChatMode; setMode: (m: ChatMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-edge-light p-0.5 text-xs dark:border-edge-dark">
      <button
        onClick={() => setMode("agent")}
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
          mode === "agent" ? "bg-accent text-white" : "text-gray-500"
        }`}
      >
        <Bolt className="h-3.5 w-3.5" /> Agent
      </button>
      <button
        onClick={() => setMode("chat")}
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
          mode === "chat" ? "bg-accent text-white" : "text-gray-500"
        }`}
      >
        <ChatIcon className="h-3.5 w-3.5" /> Chat
      </button>
    </div>
  );
}
