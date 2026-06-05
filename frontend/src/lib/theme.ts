// Shared color constants for charts and category accents (kept in sync with
// the `cat.*` tokens in tailwind.config.js). Recharts needs raw hex values.

export const CATEGORY = {
  jobs: "#3b82f6",
  invoices: "#7c3aed",
  quotes: "#f59e0b",
  messages: "#06b6d4",
  customers: "#10b981",
  revenue: "#7c3aed",
  billed: "#f5b50a",
  danger: "#ef4444",
  paid: "#10b981",
  unpaid: "#f59e0b",
  neutral: "#94a3b8",
} as const;

export const JOB_STATUS_COLORS: Record<string, string> = {
  quote_requested: "#f59e0b",
  scheduled: "#3b82f6",
  in_progress: "#06b6d4",
  completed: "#10b981",
};

// RGB triplets for MagicCard spotlight / glows.
export const CATEGORY_RGB = {
  jobs: "59,130,246",
  invoices: "124,58,237",
  quotes: "245,158,11",
  messages: "6,182,212",
  customers: "16,185,129",
  revenue: "124,58,237",
} as const;
