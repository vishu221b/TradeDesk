import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { chatApi } from "../api/endpoints";
import type { ChatMode, ProviderInfo } from "../api/types";
import { ChatProvider } from "../context/ChatContext";
import { Sidebar, type View } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ChatRoute } from "./ChatRoute";
import { DataView, type DataTab } from "./DataView";
import { SettingsView } from "./SettingsView";
import { Dashboard } from "./Dashboard";

const TITLES: Record<View, string> = {
  home: "Dashboard",
  chat: "Job Desk",
  settings: "Settings",
  jobs: "Jobs",
  invoices: "Invoices",
  quotes: "Quotes",
  messages: "Messages",
  customers: "Customers",
};

// Keys for the picks we persist across sessions.
const LS = { provider: "tradedesk_provider", model: "tradedesk_model", mode: "tradedesk_mode" };

/** Derive the active view id from the URL so the TopBar title + Sidebar stay in sync. */
export function viewFromPath(pathname: string): View {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  if (seg === "") return "home";
  if (seg === "chat") return "chat";
  if (seg === "settings") return "settings";
  if (["jobs", "invoices", "quotes", "messages", "customers"].includes(seg)) return seg as View;
  return "home";
}

export function Workspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = viewFromPath(location.pathname);

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
        <Sidebar />

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
            <Routes>
              <Route path="/" element={<Dashboard onNavigate={(v) => navigate(v === "home" ? "/" : `/${v}`)} />} />
              <Route
                path="/chat"
                element={
                  <ChatRoute provider={provider} model={model} mode={mode} setMode={setMode} />
                }
              />
              <Route
                path="/chat/:conversationId"
                element={
                  <ChatRoute provider={provider} model={model} mode={mode} setMode={setMode} />
                }
              />
              <Route path="/jobs" element={<DataView key="jobs" tab="jobs" />} />
              <Route path="/invoices" element={<DataView key="invoices" tab="invoices" />} />
              <Route path="/quotes" element={<DataView key="quotes" tab="quotes" />} />
              <Route path="/messages" element={<DataView key="messages" tab="messages" />} />
              <Route path="/customers" element={<DataView key="customers" tab="customers" />} />
              <Route
                path="/settings"
                element={<SettingsView providers={providers} onProvidersRefresh={refreshProviders} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </ChatProvider>
  );
}

// re-export for callers that referenced it from here previously
export type { DataTab };
