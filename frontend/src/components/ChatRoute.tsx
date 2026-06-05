import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  const location = useLocation();
  const seed = (location.state as { seed?: string } | null)?.seed;
  const { selectConversation, newChat, setInput, activeKey } = useChat();

  // URL -> active session. A `seed` (e.g. "discuss this summary") prefills the
  // composer of a fresh chat so the user can immediately ask follow-ups.
  useEffect(() => {
    if (conversationId) {
      selectConversation(Number(conversationId));
    } else {
      newChat();
      if (seed) {
        setInput(NEW_KEY, seed);
        // Consume the router state so a reload/back doesn't re-seed.
        window.history.replaceState({}, "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, seed]);

  // When a brand-new chat gets persisted, reflect its id in the URL.
  useEffect(() => {
    if (!conversationId && activeKey !== NEW_KEY) {
      navigate(`/chat/${activeKey}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  return <ChatView {...props} />;
}
