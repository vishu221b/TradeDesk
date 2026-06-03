import { useState } from "react";
import { authApi, opsApi } from "../api/endpoints";
import { apiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { ProviderInfo } from "../api/types";
import { Badge, Button } from "./ui";

const KEYED_PROVIDERS = ["anthropic", "openai", "gemini", "ollama"];

export function SettingsView({ providers, onProvidersRefresh }: { providers: ProviderInfo[]; onProvidersRefresh: () => void }) {
  const { user, refreshUser } = useAuth();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const save = async (provider: string) => {
    setBusy(provider);
    setMsg("");
    try {
      await authApi.setProviderKey(provider, keys[provider] ?? "");
      await refreshUser();
      onProvidersRefresh();
      setKeys((k) => ({ ...k, [provider]: "" }));
      setMsg(`Saved key for ${provider}.`);
    } catch (e) {
      setMsg(apiError(e));
    } finally {
      setBusy("");
    }
  };

  const clear = async (provider: string) => {
    setBusy(provider);
    try {
      await authApi.setProviderKey(provider, "");
      await refreshUser();
      onProvidersRefresh();
      setMsg(`Cleared key for ${provider}.`);
    } catch (e) {
      setMsg(apiError(e));
    } finally {
      setBusy("");
    }
  };

  const loadSample = async (replace: boolean) => {
    setBusy("sample");
    setMsg("");
    try {
      await opsApi.loadSample();
      setMsg(replace ? "Sample data reloaded." : "Sample data loaded (if the account was empty).");
    } catch (e) {
      setMsg(apiError(e));
    } finally {
      setBusy("");
    }
  };

  const hasUserKey = (p: string) => user?.provider_keys.includes(p);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <section>
        <h2 className="mb-1 text-lg font-semibold">Account</h2>
        <div className="card p-4 text-sm">
          <p>
            Signed in as <strong>{user?.username}</strong>
          </p>
          {user?.email && <p className="text-gray-500">{user.email}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Provider API keys</h2>
        <p className="mb-3 text-sm text-gray-500">
          Keys are stored encrypted against your account and override any server-side key. The
          built-in <Badge tone="blue">mock</Badge> provider always works without a key.
        </p>
        <div className="space-y-3">
          {KEYED_PROVIDERS.map((p) => {
            const info = providers.find((x) => x.id === p);
            return (
              <div key={p} className="card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium capitalize">{p}</span>
                  {hasUserKey(p) ? (
                    <Badge tone="accent">your key</Badge>
                  ) : info?.source === "server" ? (
                    <Badge tone="green">server key</Badge>
                  ) : info?.source === "local" ? (
                    <Badge tone="blue">local</Badge>
                  ) : (
                    <Badge tone="amber">no key</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className="input"
                    placeholder={hasUserKey(p) ? "•••••••• (set — enter to replace)" : `${p} API key`}
                    value={keys[p] ?? ""}
                    onChange={(e) => setKeys((k) => ({ ...k, [p]: e.target.value }))}
                  />
                  <Button onClick={() => save(p)} loading={busy === p} disabled={!keys[p]}>
                    Save
                  </Button>
                  {hasUserKey(p) && (
                    <Button variant="outline" onClick={() => clear(p)} loading={busy === p}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Sample data</h2>
        <div className="card flex items-center gap-3 p-4">
          <p className="flex-1 text-sm text-gray-500">
            Populate your account with a rich sample dataset (jobs, invoices, customers) to explore.
          </p>
          <Button onClick={() => loadSample(false)} loading={busy === "sample"}>
            Load sample data
          </Button>
        </div>
      </section>

      {msg && <p className="text-sm text-accent">{msg}</p>}
    </div>
  );
}
