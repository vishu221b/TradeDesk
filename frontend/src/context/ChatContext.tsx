import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { chatApi } from "../api/endpoints";
import { apiError } from "../api/client";
import type { ChatMessage, ChatMode, Conversation } from "../api/types";

/** Key used for the not-yet-persisted "new chat" draft. */
export const NEW_KEY = "new";

export interface ChatSession {
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  error: string;
  loaded: boolean;
}

export interface SendSettings {
  provider: string;
  model: string;
  mode: ChatMode;
}

interface ChatCtx {
  conversations: Conversation[];
  refreshConversations: () => void;
  activeKey: string;
  activeConversationId: number | null;
  selectConversation: (id: number) => void;
  newChat: () => void;
  deleteConversation: (id: number) => Promise<void>;
  session: (key: string) => ChatSession;
  setInput: (key: string, value: string) => void;
  send: (key: string, text: string, settings: SendSettings) => Promise<void>;
  sendingKeys: Set<string>;
}

const EMPTY: ChatSession = { messages: [], input: "", sending: false, error: "", loaded: false };
const emptySession = (): ChatSession => ({ ...EMPTY });

const Ctx = createContext<ChatCtx | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sessions, setSessions] = useState<Record<string, ChatSession>>({});
  const [activeKey, setActiveKey] = useState<string>(NEW_KEY);

  // Refs let async callbacks read fresh state without widening effect deps.
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const inflight = useRef<Set<string>>(new Set());
  const loadingRef = useRef<Set<string>>(new Set());

  const refreshConversations = useCallback(() => {
    chatApi.conversations().then(setConversations).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Lazily load a conversation's transcript the first time it becomes active.
  useEffect(() => {
    if (activeKey === NEW_KEY) return;
    const key = activeKey;
    setSessions((prev) => (prev[key] ? prev : { ...prev, [key]: emptySession() }));
    const existing = sessionsRef.current[key];
    if (existing?.loaded || inflight.current.has(key) || loadingRef.current.has(key)) return;
    loadingRef.current.add(key);
    chatApi
      .conversation(Number(key))
      .then((c) =>
        setSessions((prev) => ({
          ...prev,
          [key]: { ...(prev[key] ?? emptySession()), messages: c.messages, loaded: true },
        })),
      )
      .catch((e) =>
        setSessions((prev) => ({
          ...prev,
          [key]: { ...(prev[key] ?? emptySession()), error: apiError(e) },
        })),
      )
      .finally(() => loadingRef.current.delete(key));
  }, [activeKey]);

  const session = useCallback((key: string) => sessions[key] ?? EMPTY, [sessions]);

  const setInput = useCallback((key: string, value: string) => {
    setSessions((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptySession()), input: value } }));
  }, []);

  const selectConversation = useCallback((id: number) => setActiveKey(String(id)), []);

  const newChat = useCallback(() => {
    // Only reset the draft if it isn't mid-flight, so a pending send survives.
    if (!inflight.current.has(NEW_KEY)) {
      setSessions((prev) => ({ ...prev, [NEW_KEY]: emptySession() }));
    }
    setActiveKey(NEW_KEY);
  }, []);

  const deleteConversation = useCallback(
    async (id: number) => {
      await chatApi.deleteConversation(id).catch(() => undefined);
      const key = String(id);
      setSessions((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setActiveKey((curr) => (curr === key ? NEW_KEY : curr));
      refreshConversations();
    },
    [refreshConversations],
  );

  const send = useCallback(
    async (key: string, text: string, settings: SendSettings) => {
      const trimmed = text.trim();
      if (!trimmed || inflight.current.has(key)) return;
      inflight.current.add(key);

      const convId = key === NEW_KEY ? undefined : Number(key);
      const optimistic: ChatMessage = {
        id: -Date.now(),
        role: "user",
        content: trimmed,
        tool_calls: [],
      };

      setSessions((prev) => {
        const s = prev[key] ?? emptySession();
        return {
          ...prev,
          [key]: { ...s, messages: [...s.messages, optimistic], input: "", sending: true, error: "" },
        };
      });

      try {
        const res = await chatApi.send({
          message: trimmed,
          provider: settings.provider,
          model: settings.model || undefined,
          mode: settings.mode,
          conversation_id: convId,
        });
        const assistant: ChatMessage = {
          id: -(Date.now() + 1),
          role: "assistant",
          content: res.reply,
          tool_calls: res.tool_calls,
        };

        if (key === NEW_KEY) {
          // Promote the draft to its persisted conversation id; reset the draft.
          const newKey = String(res.conversation_id);
          setSessions((prev) => {
            const s = prev[NEW_KEY] ?? emptySession();
            return {
              ...prev,
              [newKey]: { messages: [...s.messages, assistant], input: "", sending: false, error: "", loaded: true },
              [NEW_KEY]: emptySession(),
            };
          });
          setActiveKey((curr) => (curr === NEW_KEY ? newKey : curr));
        } else {
          setSessions((prev) => {
            const s = prev[key] ?? emptySession();
            return { ...prev, [key]: { ...s, messages: [...s.messages, assistant], sending: false } };
          });
        }
        refreshConversations();
      } catch (e) {
        const msg = apiError(e, "The agent could not complete that request.");
        setSessions((prev) => {
          const s = prev[key] ?? emptySession();
          return {
            ...prev,
            [key]: {
              ...s,
              messages: s.messages.filter((m) => m.id !== optimistic.id),
              sending: false,
              error: msg,
              input: trimmed,
            },
          };
        });
      } finally {
        inflight.current.delete(key);
      }
    },
    [refreshConversations],
  );

  const sendingKeys = new Set(
    Object.entries(sessions)
      .filter(([, s]) => s.sending)
      .map(([k]) => k),
  );

  const value: ChatCtx = {
    conversations,
    refreshConversations,
    activeKey,
    activeConversationId: activeKey === NEW_KEY ? null : Number(activeKey),
    selectConversation,
    newChat,
    deleteConversation,
    session,
    setInput,
    send,
    sendingKeys,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChat(): ChatCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
