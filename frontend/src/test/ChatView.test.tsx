import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { send, conversation } = vi.hoisted(() => ({ send: vi.fn(), conversation: vi.fn() }));

vi.mock("../api/endpoints", () => ({ chatApi: { send, conversation } }));

import { ChatView } from "../components/ChatView";

function renderChat(overrides: Partial<Parameters<typeof ChatView>[0]> = {}) {
  return render(
    <ChatView
      conversationId={null}
      provider="mock"
      model=""
      mode="agent"
      setMode={() => {}}
      onConversationChange={overrides.onConversationChange ?? vi.fn()}
      onConversationsRefresh={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ChatView", () => {
  beforeEach(() => send.mockReset());

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
    const onConversationChange = vi.fn();
    renderChat({ onConversationChange });

    await userEvent.type(screen.getByPlaceholderText(/Ask about jobs/i), "what is overdue?");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ message: "what is overdue?", provider: "mock", mode: "agent" }),
    );
    expect(await screen.findByText("I found 4 overdue invoices.")).toBeInTheDocument();
    expect(screen.getByText("list_invoices")).toBeInTheDocument();
    expect(onConversationChange).toHaveBeenCalledWith(7);
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
