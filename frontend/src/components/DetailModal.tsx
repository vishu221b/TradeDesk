import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { chatApi } from "../api/endpoints";
import { apiError } from "../api/client";
import { Button } from "./ui";
import { Bolt, Spinner } from "./icons";

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
  provider: string;
  model: string;
}

// Minimal markdown-ish rendering for the AI summary: bold, inline code, lists.
function renderRich(text: string) {
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
  provider,
  model,
}: Props) {
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usedProvider, setUsedProvider] = useState("");

  // Reset AI state whenever a different record is opened.
  useEffect(() => {
    if (open) {
      setSummary("");
      setError("");
      setUsedProvider("");
    }
  }, [open, title]);

  const summarize = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await chatApi.summarize({
        title: summaryTitle,
        context: summaryContext,
        provider,
        model: model || undefined,
      });
      setSummary(res.summary);
      setUsedProvider(`${res.provider}${res.model ? ` · ${res.model}` : ""}`);
    } catch (e) {
      setError(apiError(e, "Could not generate a summary."));
    } finally {
      setBusy(false);
    }
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

            <div className="grid gap-0 md:grid-cols-[1fr_320px]">
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
              <div className="border-t border-edge-light bg-black/[0.015] p-5 dark:border-edge-dark dark:bg-white/[0.02] md:border-l md:border-t-0">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-glow">
                    <Bolt className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold">AI summary</span>
                </div>

                {!summary && !busy && (
                  <p className="mb-3 text-xs text-gray-500">
                    Generate an in-depth, plain-language summary of this record using your selected
                    provider &amp; model.
                  </p>
                )}

                {busy && (
                  <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
                    <Spinner className="h-4 w-4 text-accent" /> Summarizing…
                  </div>
                )}

                {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

                {summary && (
                  <div className="mb-3 max-h-[44vh] space-y-1 overflow-y-auto text-sm leading-relaxed">
                    {renderRich(summary)}
                    {usedProvider && (
                      <p className="mt-3 text-[11px] text-gray-400">via {usedProvider}</p>
                    )}
                  </div>
                )}

                <Button onClick={summarize} loading={busy} className="w-full">
                  <Bolt className="h-4 w-4" /> {summary ? "Regenerate" : "Summarize with AI"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
