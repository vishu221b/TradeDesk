import type { ChatMessage } from "../api/types";
import { Wrench } from "./icons";

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
  onShowTools,
  highlight = false,
}: {
  message: ChatMessage;
  /** Called when the tool-call summary is clicked — opens the tool panel. */
  onShowTools?: () => void;
  highlight?: boolean;
}) {
  const isUser = message.role === "user";
  const toolCount = message.tool_calls?.length ?? 0;
  const hasTools = toolCount > 0;
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
        {hasTools && (
          <button
            type="button"
            onClick={onShowTools}
            className="flex items-center gap-1.5 rounded-lg border border-edge-light px-2.5 py-1 text-left text-xs font-medium text-gray-500 transition hover:border-accent hover:text-accent dark:border-edge-dark"
            title="View tool calls in the panel"
          >
            <Wrench className="h-3.5 w-3.5" />
            {toolCount} tool call{toolCount > 1 ? "s" : ""} · view
          </button>
        )}
      </div>
    </div>
  );
}
