import { useChat, NEW_KEY } from "../context/ChatContext";
import { Bolt, ChartBar, Chat, Database, Home, Plus, Settings, Spinner, Trash } from "./icons";

export type View = "home" | "chat" | "data" | "settings";

interface Props {
  view: View;
  setView: (v: View) => void;
}

const NAV: { id: View; label: string; icon: typeof Chat }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "chat", label: "Chat", icon: Chat },
  { id: "data", label: "Data", icon: Database },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ view, setView }: Props) {
  const {
    conversations,
    activeKey,
    activeConversationId,
    selectConversation,
    newChat,
    deleteConversation,
    session,
    sendingKeys,
  } = useChat();

  const open = (id: number) => {
    selectConversation(id);
    setView("chat");
  };

  // A new chat that is mid-send must stay listed even after the user navigates
  // to another conversation — otherwise the in-flight chat vanishes until it
  // resolves. Show it whenever the draft is active OR a send is in flight.
  const newPending = sendingKeys.has(NEW_KEY);
  const newActive = activeKey === NEW_KEY;
  const showNewItem = newActive || newPending;
  const draftTitle =
    session(NEW_KEY).messages.find((mm) => mm.role === "user")?.content || "New chat…";

  const openNew = () => {
    newChat();
    setView("chat");
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-edge-light bg-panel-light dark:border-edge-dark dark:bg-panel-dark/80 dark:backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow motion-safe:animate-pulse-glow">
          <Bolt className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight">
          Trade<span className="brand-text">Desk</span>
        </span>
      </div>

      <nav className="space-y-1 px-3">
        {NAV.map((n) => {
          const active = view === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgba(124,58,237,0.25)] dark:bg-accent/15"
                  : "text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/5"
              }`}
            >
              <n.icon
                className={`h-[18px] w-[18px] transition-transform group-hover:scale-110 ${
                  active ? "text-accent" : ""
                }`}
              />
              {n.label}
              {n.id === "chat" && view !== "chat" && sendingKeys.size > 0 && (
                <Spinner className="ml-auto h-3.5 w-3.5 text-accent" />
              )}
            </button>
          );
        })}
      </nav>

      {view === "chat" && (
        <>
          <div className="px-3 pb-2 pt-4">
            <button onClick={newChat} className="btn-outline w-full">
              <Plus className="h-4 w-4" /> New chat
            </button>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Conversations
            </p>
            {showNewItem && (
              <div
                className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm transition ${
                  newActive
                    ? "bg-accent/10 text-accent dark:bg-accent/15"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <button
                  onClick={openNew}
                  className="flex-1 truncate text-left text-gray-500 dark:text-gray-300"
                  title={draftTitle}
                >
                  {newPending ? draftTitle : "New chat…"}
                </button>
                {newPending && <Spinner className="h-3.5 w-3.5 text-accent" />}
              </div>
            )}
            {conversations.length === 0 && !showNewItem && (
              <p className="px-2 py-2 text-xs text-gray-400">No conversations yet.</p>
            )}
            {conversations.map((c) => {
              const sending = sendingKeys.has(String(c.id));
              const active = activeConversationId === c.id;
              return (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm transition ${
                    active
                      ? "bg-accent/10 text-accent dark:bg-accent/15"
                      : "hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <button onClick={() => open(c.id)} className="flex-1 truncate text-left" title={c.title}>
                    {c.title}
                  </button>
                  {sending ? (
                    <Spinner className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <button
                      onClick={() => deleteConversation(c.id)}
                      className="opacity-0 transition group-hover:opacity-100"
                      aria-label="Delete conversation"
                    >
                      <Trash className="h-4 w-4 text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      {view !== "chat" && <div className="flex-1" />}

      <div className="hidden border-t border-edge-light px-4 py-3 text-[11px] text-gray-400 dark:border-edge-dark md:block">
        <ChartBar className="mr-1 inline h-3.5 w-3.5" /> Drafts only — nothing is auto-sent.
      </div>
    </aside>
  );
}
