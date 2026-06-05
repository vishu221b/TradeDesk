import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageBubble } from "../components/MessageBubble";
import type { ChatMessage } from "../api/types";

describe("MessageBubble", () => {
  it("renders assistant text with bold markdown", () => {
    const m: ChatMessage = { id: 1, role: "assistant", content: "Hello **world**", tool_calls: [] };
    render(<MessageBubble message={m} />);
    expect(screen.getByText("world").tagName).toBe("STRONG");
  });

  it("shows a compact tool-call summary, not the full call details", () => {
    const m: ChatMessage = {
      id: 2,
      role: "assistant",
      content: "Found them.",
      tool_calls: [{ name: "list_invoices", input: { only_overdue: true }, output: [{ id: "INV-1" }] }],
    };
    render(<MessageBubble message={m} />);

    // The summary is shown inline…
    expect(screen.getByText(/1 tool call · view/i)).toBeInTheDocument();
    // …but the raw tool name / output never render inside the bubble.
    expect(screen.queryByText("list_invoices")).not.toBeInTheDocument();
    expect(screen.queryByText(/INV-1/)).not.toBeInTheDocument();
  });

  it("pluralises the summary and opens the panel on click", async () => {
    const onShowTools = vi.fn();
    const m: ChatMessage = {
      id: 3,
      role: "assistant",
      content: "Done.",
      tool_calls: [
        { name: "list_invoices", input: {}, output: [] },
        { name: "get_job", input: { ref: "JOB-1" }, output: {} },
      ],
    };
    render(<MessageBubble message={m} onShowTools={onShowTools} />);

    const summary = screen.getByText(/2 tool calls · view/i);
    await userEvent.click(summary);
    expect(onShowTools).toHaveBeenCalledOnce();
  });
});
