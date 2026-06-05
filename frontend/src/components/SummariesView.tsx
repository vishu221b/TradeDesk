import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { summariesApi } from "../api/endpoints";
import { apiError } from "../api/client";
import type { Summary } from "../api/types";
import { exportSummaryPdf } from "../lib/pdf";
import { summaryChatSeed } from "../lib/chatSeed";
import { Badge, Button, Spin } from "./ui";
import { renderRich } from "./DetailModal";
import { Chat, FileText, Refresh, Sparkles, Trash } from "./icons";

const SUBJECT_TONE: Record<string, string> = {
  invoice: "accent",
  quote: "amber",
  job: "blue",
  customer: "green",
  metric: "neutral",
};

export function SummariesView({ provider, model }: { provider: string; model: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await summariesApi.list());
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const regenerate = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await summariesApi.regenerate(selected.id, { provider, model: model || undefined });
      setSelected(updated);
      setItems((xs) => xs.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this summary?")) return;
    setBusy(true);
    try {
      await summariesApi.remove(id);
      setSelected(null);
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const discuss = (s: Summary) => navigate("/chat", { state: { seed: summaryChatSeed(s) } });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge-light px-4 py-2.5 dark:border-edge-dark md:px-6">
        <Sparkles className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">
          Saved summaries
          {!loading && <span className="ml-1.5 text-gray-400">({items.length})</span>}
        </h2>
        <Button variant="outline" onClick={load} className="ml-auto px-2.5 py-1.5" aria-label="Refresh">
          <Refresh className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <Spin />
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : items.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-10 text-center">
            <Sparkles className="h-6 w-6 text-accent" />
            <p className="text-sm font-medium">No saved summaries yet</p>
            <p className="max-w-md text-sm text-gray-500">
              Open any card on the dashboard and hit <strong>Summarize with AI</strong> — summaries
              are saved here so you can revisit, regenerate, export, or chat about them.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="card card-interactive flex flex-col p-4 text-left"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge tone={SUBJECT_TONE[s.subject_type] ?? "neutral"}>
                    {s.subject_type}
                    {s.subject_ref ? ` · ${s.subject_ref}` : ""}
                  </Badge>
                  <span className="ml-auto text-[11px] text-gray-400">
                    {new Date(s.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-semibold">{s.title}</p>
                <p className="mt-1 line-clamp-3 text-sm text-gray-500">
                  {s.summary.replace(/[*_`#]/g, "").slice(0, 220)}
                </p>
                <p className="mt-2 text-[11px] text-gray-400">
                  via {s.provider}
                  {s.model ? ` · ${s.model}` : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setSelected(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="card w-full max-w-2xl overflow-hidden p-0"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <div className="flex items-start gap-3 border-b border-edge-light px-5 py-4 dark:border-edge-dark">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={SUBJECT_TONE[selected.subject_type] ?? "neutral"}>
                      {selected.subject_type}
                      {selected.subject_ref ? ` · ${selected.subject_ref}` : ""}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold">{selected.title}</h3>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Updated {new Date(selected.updated_at).toLocaleString()} · via {selected.provider}
                    {selected.model ? ` · ${selected.model}` : ""}
                  </p>
                </div>
                <button className="btn-ghost ml-auto px-2 py-1" onClick={() => setSelected(null)} aria-label="Close">
                  ✕
                </button>
              </div>

              <div className="max-h-[50vh] space-y-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed">
                {busy ? (
                  <Spin />
                ) : (
                  renderRich(selected.summary)
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-edge-light px-5 py-3 dark:border-edge-dark">
                <Button variant="outline" onClick={regenerate} disabled={busy} className="py-1.5">
                  <Refresh className="h-4 w-4" /> Regenerate
                </Button>
                <Button variant="outline" onClick={() => exportSummaryPdf(selected)} disabled={busy} className="py-1.5">
                  <FileText className="h-4 w-4" /> Export PDF
                </Button>
                <Button onClick={() => discuss(selected)} disabled={busy} className="py-1.5">
                  <Chat className="h-4 w-4" /> Discuss in chat
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => remove(selected.id)}
                  disabled={busy}
                  className="ml-auto py-1.5 text-red-500 hover:text-red-600"
                >
                  <Trash className="h-4 w-4" /> Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
