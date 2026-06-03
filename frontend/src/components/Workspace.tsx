import { useCallback, useEffect, useState } from "react";
import { chatApi } from "../api/endpoints";
import type { ChatMode, ProviderInfo } from "../api/types";
import { ChatProvider } from "../context/ChatContext";
import { Sidebar, type View } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ChatView } from "./ChatView";
import { DataView } from "./DataView";
import { SettingsView } from "./SettingsView";
import { Dashboard } from "./Dashboard";

const TITLES: Record<View, string> = {
  home: "Dashboard",
  chat: "Job Desk",
  data: "Operational Data",
  settings: "Settings",
};

// Keys for the picks we persist across sessions.
const LS = { provider: "tradedesk_provider", model: "tradedesk_model", mode: "tradedesk_mode" };

export function Workspace() {
  const [view, setView] = useState<View>("home");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProviderState] = useState(() => localStorage.getItem(LS.provider) || "mock");
  const [model, setModelState] = useState(() => localStorage.getItem(LS.model) || "");
  const [mode, setModeState] = useState<ChatMode>(
    () => (localStorage.getItem(LS.mode) as ChatMode) || "agent",
  );

  const setProvider = (p: string) => {
    setProviderState(p);
    localStorage.setItem(LS.provider, p);
  };
  const setModel = (m: string) => {
    setModelState(m);
    localStorage.setItem(LS.model, m);
  };
  const setMode = (m: ChatMode) => {
    setModeState(m);
    localStorage.setItem(LS.mode, m);
  };

  const refreshProviders = useCallback(() => {
    chatApi.providers().then(setProviders).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  return (
    <ChatProvider>
      <div className="flex h-full">
        <Sidebar view={view} setView={setView} />

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
            {view === "home" && <Dashboard onNavigate={setView} />}
            {view === "chat" && (
              <ChatView provider={provider} model={model} mode={mode} setMode={setMode} />
            )}
            {view === "data" && <DataView />}
            {view === "settings" && (
              <SettingsView providers={providers} onProvidersRefresh={refreshProviders} />
            )}
          </main>
        </div>
      </div>
    </ChatProvider>
  );
}
