import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { send, conversation, conversations, deleteConversation } = vi.hoisted(() => ({
  send: vi.fn(),
  conversation: vi.fn(),
  conversations: vi.fn(),
  deleteConversation: vi.fn(),
}));

vi.mock("../api/endpoints", () => ({
  chatApi: { send, conversation, conversations, deleteConversation },
}));

import { ChatView } from "../components/ChatView";
import { ChatProvider } from "../context/ChatContext";

function renderChat(overrides: { setMode?: (m: "agent" | "chat") => void } = {}) {
  return render(
    <ChatProvider>
      <ChatView provider="mock" model="" mode="agent" setMode={overrides.setMode ?? (() => {})} />
    </ChatProvider>,
  );
}

describe("ChatView", () => {
  beforeEach(() => {
    send.mockReset();
    conversation.mockReset();
    conversations.mockReset().mockResolvedValue([]);
  });

  it("shows example prompts when empty", () => {
    renderChat();
    expect(screen.getByText(/How can I help/i)).toBeInTheDocument();
    expect(screen.getByText(/Which invoices are overdue/i)).toBeInTheDocument();
  });

  it("sends a message and renders the agent reply with tool calls", async () => {
    send.mockResolvedValue({
      conversation_id: 7,
      reply: "I found 4 overdue invoices.",
      provider: "mock",
      model: "mock-1",
      mode: "agent",
      tool_calls: [{ name: "list_invoices", input: { only_overdue: true }, output: [] }],
    });
    renderChat();

    await userEvent.type(screen.getByPlaceholderText(/Ask about jobs/i), "what is overdue?");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ message: "what is overdue?", provider: "mock", mode: "agent" }),
    );
    expect(await screen.findByText("I found 4 overdue invoices.")).toBeInTheDocument();
    expect(screen.getByText("list_invoices")).toBeInTheDocument();
  });

  it("does not send empty input and switches mode via the toggle", async () => {
    const setMode = vi.fn();
    renderChat({ setMode });

    // Clicking send with an empty composer is a no-op.
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(send).not.toHaveBeenCalled();

    // The Agent/Chat toggle drives the mode prop.
    await userEvent.click(screen.getByRole("button", { name: /chat/i }));
    expect(setMode).toHaveBeenCalledWith("chat");
  });
});
