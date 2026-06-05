import type { ProviderInfo } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Badge } from "./ui";
import { Logout, Menu, Moon, Sun } from "./icons";

interface Props {
  title: string;
  providers: ProviderInfo[];
  provider: string;
  setProvider: (p: string) => void;
  model: string;
  setModel: (m: string) => void;
  onMenuClick?: () => void;
}

export function TopBar({ title, providers, provider, setProvider, model, setModel, onMenuClick }: Props) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const current = providers.find((p) => p.id === provider);

  return (
    <header className="flex items-center gap-3 border-b border-edge-light bg-panel-light px-4 py-2.5 dark:border-edge-dark dark:bg-panel-dark md:px-6">
      <button
        onClick={onMenuClick}
        className="btn-ghost -ml-1 px-2 py-2 md:hidden"
        aria-label="Open menu"
      >
        <Menu />
      </button>
      <h1 className="text-sm font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {/* provider picker */}
        <div className="flex items-center gap-1.5">
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setModel("");
            }}
            className="input w-auto py-1.5 text-sm"
            aria-label="Model provider"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.id}
                {p.available ? "" : " (key needed)"}
              </option>
            ))}
          </select>
          {current && (
            <Badge tone={current.source === "user" ? "accent" : current.source === "server" ? "green" : "blue"}>
              {current.source || "n/a"}
            </Badge>
          )}
        </div>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={current?.default_model || "model"}
          className="input hidden w-36 py-1.5 text-sm md:block"
          aria-label="Model override"
        />

        <button onClick={toggle} className="btn-ghost px-2 py-2" aria-label="Toggle theme">
          {theme === "dark" ? <Sun /> : <Moon />}
        </button>

        <div className="flex items-center gap-2 border-l border-edge-light pl-2 dark:border-edge-dark">
          <span className="hidden text-sm text-gray-500 sm:block">{user?.username}</span>
          <button onClick={logout} className="btn-ghost px-2 py-2" aria-label="Sign out" title="Sign out">
            <Logout />
          </button>
        </div>
      </div>
    </header>
  );
}
