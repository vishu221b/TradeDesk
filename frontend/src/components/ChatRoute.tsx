import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NEW_KEY, useChat } from "../context/ChatContext";
import type { ChatMode } from "../api/types";
import { ChatView } from "./ChatView";

interface Props {
  provider: string;
  model: string;
  mode: ChatMode;
  setMode: (m: ChatMode) => void;
}

/**
 * Bridges the URL (`/chat` or `/chat/:conversationId`) with the chat context so
 * a conversation survives reloads and deep-links. Selecting from the sidebar
 * navigates the URL; this keeps the active session in sync the other way.
 */
export function ChatRoute(props: Props) {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { selectConversation, newChat, activeKey } = useChat();

  // URL -> active session.
  useEffect(() => {
    if (conversationId) selectConversation(Number(conversationId));
    else newChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // When a brand-new chat gets persisted, reflect its id in the URL.
  useEffect(() => {
    if (!conversationId && activeKey !== NEW_KEY) {
      navigate(`/chat/${activeKey}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  return <ChatView {...props} />;
}
