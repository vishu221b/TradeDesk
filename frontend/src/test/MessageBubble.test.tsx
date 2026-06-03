import { describe, expect, it } from "vitest";
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

  it("shows tool calls and reveals input/output on expand", async () => {
    const m: ChatMessage = {
      id: 2,
      role: "assistant",
      content: "Found them.",
      tool_calls: [{ name: "list_invoices", input: { only_overdue: true }, output: [{ id: "INV-1" }] }],
    };
    render(<MessageBubble message={m} />);
    const toggle = screen.getByText("list_invoices");
    expect(toggle).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.getByText("Output")).toBeInTheDocument();
    expect(screen.getByText(/INV-1/)).toBeInTheDocument();
  });
});
