import type { Conversation } from "../api/types";
import { Bolt, Chat, Database, Plus, Settings, Trash } from "./icons";

export type View = "chat" | "data" | "settings";

interface Props {
  view: View;
  setView: (v: View) => void;
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
}

const NAV: { id: View; label: string; icon: typeof Chat }[] = [
  { id: "chat", label: "Chat", icon: Chat },
  { id: "data", label: "Data", icon: Database },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ view, setView, conversations, activeId, onSelect, onNew, onDelete }: Props) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-edge-light bg-panel-light dark:border-edge-dark dark:bg-panel-dark">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
          <Bolt className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold">TradeDesk</span>
      </div>

      <nav className="space-y-1 px-3">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              view === n.id
                ? "bg-accent-soft text-accent"
                : "text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/5"
            }`}
          >
            <n.icon className="h-[18px] w-[18px]" />
            {n.label}
          </button>
        ))}
      </nav>

      {view === "chat" && (
        <>
          <div className="px-3 pb-2 pt-4">
            <button onClick={onNew} className="btn-outline w-full">
              <Plus className="h-4 w-4" /> New chat
            </button>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Conversations
            </p>
            {conversations.length === 0 && (
              <p className="px-2 py-2 text-xs text-gray-400">No conversations yet.</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm transition ${
                  activeId === c.id
                    ? "bg-black/5 dark:bg-white/10"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <button
                  onClick={() => onSelect(c.id)}
                  className="flex-1 truncate text-left"
                  title={c.title}
                >
                  {c.title}
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  className="opacity-0 transition group-hover:opacity-100"
                  aria-label="Delete conversation"
                >
                  <Trash className="h-4 w-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {view !== "chat" && <div className="flex-1" />}
    </aside>
  );
}
