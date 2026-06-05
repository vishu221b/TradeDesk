import type { ChatMessage } from "../api/types";
import { ToolCallCard } from "./ToolCallCard";

// Minimal, safe markdown-ish rendering: bold, inline code, line breaks.
function renderText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return (
      <span key={i}>
        {parts.map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**"))
            return <strong key={j}>{p.slice(2, -2)}</strong>;
          if (p.startsWith("`") && p.endsWith("`"))
            return (
              <code key={j} className="rounded bg-black/10 px-1 font-mono text-[0.85em] dark:bg-white/10">
                {p.slice(1, -1)}
              </code>
            );
          return <span key={j}>{p}</span>;
        })}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

export function MessageBubble({
  message,
  showToolCalls = true,
  highlight = false,
}: {
  message: ChatMessage;
  showToolCalls?: boolean;
  highlight?: boolean;
}) {
  const isUser = message.role === "user";
  const hasTools = message.tool_calls?.length > 0;
  return (
    <div
      data-mid={message.id}
      className={`flex scroll-mt-6 gap-3 rounded-2xl transition ${
        isUser ? "flex-row-reverse" : ""
      } ${highlight ? "ring-2 ring-accent ring-offset-2 ring-offset-transparent" : ""}`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
          isUser
            ? "bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-200"
            : "bg-brand-gradient text-white shadow-glow"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>
      <div className={`max-w-[80%] space-y-2 ${isUser ? "items-end text-right" : ""}`}>
        {message.content && (
          <div
            className={`inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? "bg-accent text-white shadow-glow"
                : "glass text-gray-800 dark:text-gray-100"
            }`}
          >
            {renderText(message.content)}
          </div>
        )}
        {hasTools && showToolCalls && (
          <div className="space-y-1.5 text-left">
            {message.tool_calls.map((c, i) => (
              <ToolCallCard key={i} call={c} />
            ))}
          </div>
        )}
        {hasTools && !showToolCalls && (
          <div className="text-left text-xs text-gray-400">
            {message.tool_calls.length} tool call{message.tool_calls.length > 1 ? "s" : ""} · see
            panel
          </div>
        )}
      </div>
    </div>
  );
}
