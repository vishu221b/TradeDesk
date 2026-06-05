import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { summariesApi } from "../api/endpoints";
import { apiError } from "../api/client";
import type { Summary } from "../api/types";
import { exportSummaryPdf } from "../lib/pdf";
import { summaryChatSeed } from "../lib/chatSeed";
import { Button } from "./ui";
import { Bolt, Chat, FileText, Refresh, Spinner } from "./icons";

export interface DetailField {
  label: string;
  value: ReactNode;
  wide?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  accent?: string; // rgb triplet for the header tint
  fields: DetailField[];
  /** Title + JSON context sent to the AI summarizer. */
  summaryTitle: string;
  summaryContext: unknown;
  subjectType?: string;
  subjectRef?: string;
  provider: string;
  model: string;
}

// Minimal markdown-ish rendering for AI summaries: bold, inline code, italics, lists.
export function renderRich(text: string) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    const bullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
    const content = bullet ? trimmed.slice(2) : line;
    const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g).filter(Boolean);
    const rendered = parts.map((p, j) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={j}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("`") && p.endsWith("`"))
        return (
          <code key={j} className="rounded bg-black/10 px-1 font-mono text-[0.85em] dark:bg-white/10">
            {p.slice(1, -1)}
          </code>
        );
      if (p.startsWith("_") && p.endsWith("_"))
        return (
          <em key={j} className="text-gray-400">
            {p.slice(1, -1)}
          </em>
        );
      return <span key={j}>{p}</span>;
    });
    return bullet ? (
      <li key={i} className="ml-4 list-disc">
        {rendered}
      </li>
    ) : (
      <p key={i} className={trimmed ? "" : "h-2"}>
        {rendered}
      </p>
    );
  });
}

export function DetailModal({
  open,
  onClose,
  title,
  subtitle,
  accent = "124,58,237",
  fields,
  summaryTitle,
  summaryContext,
  subjectType = "metric",
  subjectRef = "",
  provider,
  model,
}: Props) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Reset AI state whenever a different record is opened.
  useEffect(() => {
    if (open) {
      setSaved(null);
      setError("");
    }
  }, [open, title]);

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await summariesApi.create({
        title: summaryTitle,
        subject_type: subjectType,
        subject_ref: subjectRef,
        context: summaryContext,
        provider,
        model: model || undefined,
      });
      setSaved(res);
    } catch (e) {
      setError(apiError(e, "Could not generate a summary."));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    if (!saved) return;
    setBusy(true);
    setError("");
    try {
      setSaved(await summariesApi.regenerate(saved.id, { provider, model: model || undefined }));
    } catch (e) {
      setError(apiError(e, "Could not regenerate."));
    } finally {
      setBusy(false);
    }
  };

  const discuss = () => {
    if (!saved) return;
    navigate("/chat", { state: { seed: summaryChatSeed(saved) } });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="card w-full max-w-3xl overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {/* Header */}
            <div
              className="flex items-start gap-3 border-b border-edge-light px-5 py-4 dark:border-edge-dark"
              style={{ background: `linear-gradient(120deg, rgba(${accent},0.10), transparent 60%)` }}
            >
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
              </div>
              <button className="btn-ghost ml-auto px-2 py-1" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="grid gap-0 md:grid-cols-[1fr_340px]">
              {/* Details */}
              <div className="max-h-[60vh] overflow-y-auto p-5">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {fields.map((f, i) => (
                    <div key={i} className={f.wide ? "col-span-2" : ""}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        {f.label}
                      </dt>
                      <dd className="mt-0.5 text-sm">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* AI side panel */}
              <div className="flex max-h-[60vh] flex-col border-t border-edge-light bg-black/[0.015] p-5 dark:border-edge-dark dark:bg-white/[0.02] md:border-l md:border-t-0">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-glow">
                    <Bolt className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold">AI summary</span>
                  {saved && <span className="ml-auto text-[11px] text-emerald-500">Saved</span>}
                </div>

                {!saved && !busy && (
                  <p className="mb-3 text-xs text-gray-500">
                    Generate an in-depth, plain-language summary of this record. It's saved so you
                    can revisit, regenerate, export, or chat about it later.
                  </p>
                )}

                {busy && (
                  <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
                    <Spinner className="h-4 w-4 text-accent" /> Working…
                  </div>
                )}

                {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

                {saved && !busy && (
                  <div className="mb-3 flex-1 space-y-1 overflow-y-auto text-sm leading-relaxed">
                    {renderRich(saved.summary)}
                    <p className="mt-3 text-[11px] text-gray-400">
                      via {saved.provider}
                      {saved.model ? ` · ${saved.model}` : ""}
                    </p>
                  </div>
                )}

                {!saved ? (
                  <Button onClick={generate} loading={busy} className="w-full">
                    <Bolt className="h-4 w-4" /> Summarize with AI
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={regenerate} disabled={busy} className="py-1.5">
                      <Refresh className="h-4 w-4" /> Regenerate
                    </Button>
                    <Button variant="outline" onClick={() => exportSummaryPdf(saved)} disabled={busy} className="py-1.5">
                      <FileText className="h-4 w-4" /> Export PDF
                    </Button>
                    <Button onClick={discuss} disabled={busy} className="col-span-2 py-1.5">
                      <Chat className="h-4 w-4" /> Discuss in chat
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
