import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { apiError } from "../api/client";
import { Button } from "../components/ui";
import { Particles } from "../components/Particles";
import { Aurora } from "../components/Aurora";
import { ArrowLeft, Bolt, Moon, Sun } from "../components/icons";

export function Login({ onBack }: { onBack?: () => void }) {
  const { login, register } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(username, password);
      else await register(username, password);
    } catch (err) {
      setError(apiError(err, "Authentication failed"));
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setMode("login");
    setUsername("demo");
    setPassword("demo1234");
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-brand-radial p-4">
      <Aurora />
      <Particles quantity={60} />
      {onBack && (
        <button
          onClick={onBack}
          className="btn-ghost fixed left-4 top-4 px-2.5 py-2"
          aria-label="Back to home"
        >
          <ArrowLeft />
        </button>
      )}
      <button
        onClick={toggle}
        className="btn-ghost fixed right-4 top-4 px-2.5 py-2"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun /> : <Moon />}
      </button>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow motion-safe:animate-pulse-glow">
            <Bolt />
          </div>
          <h1 className="text-2xl font-bold">
            Trade<span className="brand-text">Desk</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            AI job desk for trade & field-service operations
          </p>
        </div>

        <form onSubmit={submit} className="glass glow-border space-y-4 p-6">
          <div className="flex rounded-lg bg-gray-100 p-1 text-sm dark:bg-white/5">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium capitalize transition ${
                  mode === m ? "bg-white shadow-sm dark:bg-panel-dark" : "text-gray-500"
                }`}
              >
                {m === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium">
              Username
            </label>
            <input
              id="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          <Button type="submit" loading={busy} className="w-full">
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>

          <button
            type="button"
            onClick={fillDemo}
            className="w-full text-center text-xs text-gray-500 hover:text-accent"
          >
            Use the demo account (demo / demo1234)
          </button>
        </form>
      </div>
    </div>
  );
}
