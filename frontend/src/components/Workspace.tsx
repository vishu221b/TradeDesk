import { useCallback, useEffect, useState } from "react";
import { chatApi } from "../api/endpoints";
import type { ChatMode, Conversation, ProviderInfo } from "../api/types";
import { Sidebar, type View } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ChatView } from "./ChatView";
import { DataView } from "./DataView";
import { SettingsView } from "./SettingsView";

const TITLES: Record<View, string> = {
  chat: "Job Desk",
  data: "Operational Data",
  settings: "Settings",
};

export function Workspace() {
  const [view, setView] = useState<View>("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState("mock");
  const [model, setModel] = useState("");
  const [mode, setMode] = useState<ChatMode>("agent");

  const refreshConversations = useCallback(() => {
    chatApi.conversations().then(setConversations).catch(() => undefined);
  }, []);

  const refreshProviders = useCallback(() => {
    chatApi.providers().then(setProviders).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshConversations();
    refreshProviders();
  }, [refreshConversations, refreshProviders]);

  const deleteConversation = async (id: number) => {
    await chatApi.deleteConversation(id).catch(() => undefined);
    if (activeId === id) setActiveId(null);
    refreshConversations();
  };

  return (
    <div className="flex h-full">
      <Sidebar
        view={view}
        setView={setView}
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          setView("chat");
        }}
        onNew={() => {
          setActiveId(null);
          setView("chat");
        }}
        onDelete={deleteConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={TITLES[view]}
          providers={providers}
          provider={provider}
          setProvider={setProvider}
          model={model}
          setModel={setModel}
        />
        <main className="min-h-0 flex-1 overflow-hidden">
          {view === "chat" && (
            <ChatView
              conversationId={activeId}
              provider={provider}
              model={model}
              mode={mode}
              setMode={setMode}
              onConversationChange={setActiveId}
              onConversationsRefresh={refreshConversations}
            />
          )}
          {view === "data" && <DataView />}
          {view === "settings" && (
            <SettingsView providers={providers} onProvidersRefresh={refreshProviders} />
          )}
        </main>
      </div>
    </div>
  );
}
