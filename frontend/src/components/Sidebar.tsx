import { useLocation, useNavigate } from "react-router-dom";
import { useChat, NEW_KEY } from "../context/ChatContext";
import { viewFromPath, type DataTab, type View } from "../lib/nav";
import {
  Bolt,
  Briefcase,
  ChartBar,
  Chat,
  FileSign,
  FileText,
  Home,
  Mail,
  Plus,
  Settings,
  Sparkles,
  Spinner,
  Trash,
  Users,
  X,
} from "./icons";

export type { DataTab, View };

const NAV: { id: View; label: string; icon: typeof Chat }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "chat", label: "Chat", icon: Chat },
  { id: "summaries", label: "Summaries", icon: Sparkles },
];

const DATA_NAV: { id: DataTab; label: string; icon: typeof Chat }[] = [
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "quotes", label: "Quotes", icon: FileSign },
  { id: "messages", label: "Messages", icon: Mail },
  { id: "customers", label: "Customers", icon: Users },
];

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const view = viewFromPath(location.pathname);
  const isChat = location.pathname.startsWith("/chat");

  const {
    conversations,
    activeKey,
    activeConversationId,
    newChat,
    deleteConversation,
    session,
    sendingKeys,
  } = useChat();

  const go = (v: View) => navigate(v === "home" ? "/" : `/${v}`);
  const openConversation = (id: number) => navigate(`/chat/${id}`);
  const removeConversation = async (id: number) => {
    await deleteConversation(id);
    if (activeConversationId === id) navigate("/chat");
  };

  const newPending = sendingKeys.has(NEW_KEY);
  const newActive = activeKey === NEW_KEY;
  const showNewItem = newActive || newPending;
  const draftTitle =
    session(NEW_KEY).messages.find((mm) => mm.role === "user")?.content || "New chat…";

  const openNew = () => {
    newChat();
    navigate("/chat");
  };

  const navBtn = (active: boolean) =>
    `group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
      active
        ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgba(124,58,237,0.25)] dark:bg-accent/15"
        : "text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/5"
    }`;

  return (
    <>
      {/* Mobile backdrop — tap to dismiss the drawer. */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col border-r border-edge-light bg-panel-light transition-transform duration-200 ease-out dark:border-edge-dark dark:bg-panel-dark/80 dark:backdrop-blur-xl md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow motion-safe:animate-pulse-glow">
          <Bolt className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight">
          Trade<span className="brand-text">Desk</span>
        </span>
        <button
          onClick={onClose}
          className="btn-ghost ml-auto px-2 py-2 md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-1 px-3">
        {NAV.map((n) => {
          const active = view === n.id;
          return (
            <button key={n.id} onClick={() => go(n.id)} className={navBtn(active)}>
              <n.icon
                className={`h-[18px] w-[18px] transition-transform group-hover:scale-110 ${
                  active ? "text-accent" : ""
                }`}
              />
              {n.label}
              {n.id === "chat" && !isChat && sendingKeys.size > 0 && (
                <Spinner className="ml-auto h-3.5 w-3.5 text-accent" />
              )}
            </button>
          );
        })}

        {/* Data — each table is its own selectable entry. */}
        <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Data
        </p>
        {DATA_NAV.map((n) => {
          const active = view === n.id;
          return (
            <button key={n.id} onClick={() => go(n.id)} className={navBtn(active)}>
              <n.icon
                className={`h-[18px] w-[18px] transition-transform group-hover:scale-110 ${
                  active ? "text-accent" : ""
                }`}
              />
              {n.label}
            </button>
          );
        })}

        <div className="pt-3">
          <button onClick={() => go("settings")} className={navBtn(view === "settings")}>
            <Settings
              className={`h-[18px] w-[18px] transition-transform group-hover:scale-110 ${
                view === "settings" ? "text-accent" : ""
              }`}
            />
            Settings
          </button>
        </div>
      </nav>

      {isChat && (
        <>
          <div className="px-3 pb-2 pt-4">
            <button onClick={openNew} className="btn-outline w-full">
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
                  <button onClick={() => openConversation(c.id)} className="flex-1 truncate text-left" title={c.title}>
                    {c.title}
                  </button>
                  {sending ? (
                    <Spinner className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <button
                      onClick={() => removeConversation(c.id)}
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
      {!isChat && <div className="flex-1" />}

      <div className="hidden border-t border-edge-light px-4 py-3 text-[11px] text-gray-400 dark:border-edge-dark md:block">
        <ChartBar className="mr-1 inline h-3.5 w-3.5" /> Drafts only — nothing is auto-sent.
      </div>
      </aside>
    </>
  );
}
