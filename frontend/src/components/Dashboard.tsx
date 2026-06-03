import { useEffect, useState } from "react";
import { opsApi } from "../api/endpoints";
import { apiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Metrics } from "../api/types";
import type { View } from "./Sidebar";
import { Badge, Button, Spin } from "./ui";
import { Aurora } from "./Aurora";
import { Particles } from "./Particles";
import { ArrowRight, ChartBar } from "./icons";

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});
const pct = (n: number) => `${Math.round(n * 100)}%`;

const STATUS_LABELS: Record<string, string> = {
  quote_requested: "Quote requested",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
};
const STATUS_TONE: Record<string, string> = {
  completed: "green",
  in_progress: "blue",
  scheduled: "blue",
  quote_requested: "amber",
};

export function Dashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { user } = useAuth();
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setM(await opsApi.metrics());
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadSample = async () => {
    setBusy(true);
    try {
      await opsApi.loadSample();
      await load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spin />;
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!m) return null;

  const isEmpty = m.invoices_total === 0 && m.customers_total === 0 && m.jobs_total === 0;

  return (
    <div className="h-full overflow-y-auto">
      {/* Hero */}
      <div className="relative overflow-hidden bg-brand-radial">
        <Aurora subtle />
        <Particles quantity={36} />
        <div className="relative mx-auto max-w-6xl px-4 pb-2 pt-8 md:px-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Welcome back{user?.username ? `, ${user.username}` : ""}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight md:text-3xl">
            Here's your business <span className="brand-text">at a glance</span>
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-4 md:px-8">
        {isEmpty && (
          <div className="card flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This account has no data yet. Load the sample dataset to see the dashboard come alive.
            </p>
            <Button onClick={loadSample} loading={busy}>
              Load sample data
            </Button>
          </div>
        )}

        {/* Primary KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Revenue collected" value={aud.format(m.revenue_collected)} accent
            sub={`${m.invoices_paid} paid invoices`} />
          <Kpi label="Outstanding" value={aud.format(m.outstanding)}
            sub={`${m.invoices_unpaid} unpaid`} />
          <Kpi label="Overdue" value={aud.format(m.overdue_amount)} danger
            sub={`${m.overdue_count} ${m.overdue_count === 1 ? "invoice" : "invoices"} past due`} />
          <Kpi label="Active jobs" value={String(m.active_jobs)}
            sub={`${m.high_priority_jobs} high priority`} />
        </div>

        {/* Secondary metrics with mini gauges */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Gauge label="Collection rate" value={pct(m.collection_rate)} ratio={m.collection_rate}
            hint="of billed revenue received" />
          <Gauge label="Customer retention" value={pct(m.repeat_rate)} ratio={m.repeat_rate} gold
            hint={`${m.repeat_customers} repeat customers`} />
          <Kpi label="Quote pipeline" value={aud.format(m.quote_pipeline)}
            sub={`${m.quotes_count} quotes drafted`} />
          <Kpi label="Avg invoice" value={aud.format(m.avg_invoice)}
            sub={`${m.customers_total} customers · ${m.active_customers} active`} />
        </div>

        {/* Revenue trend + Job funnel */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Revenue trend</h2>
                <p className="text-xs text-gray-500">Collected vs billed, last 6 months (AUD)</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <Legend className="bg-accent" label="Collected" />
                <Legend className="bg-gold" label="Billed" />
              </div>
            </div>
            <RevenueChart data={m.revenue_by_month} />
          </div>

          <div className="card p-5">
            <h2 className="mb-1 font-semibold">Job funnel</h2>
            <p className="mb-4 text-xs text-gray-500">{m.jobs_total} jobs total</p>
            <JobFunnel byStatus={m.jobs_by_status} total={m.jobs_total} />
          </div>
        </div>

        {/* Top overdue */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Top overdue invoices</h2>
              <p className="text-xs text-gray-500">Largest balances past their due date</p>
            </div>
            <Button variant="outline" className="py-1.5" onClick={() => onNavigate("chat")}>
              Draft reminders <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {m.top_overdue.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nothing overdue — nicely done.</p>
          ) : (
            <ul className="divide-y divide-edge-light dark:divide-edge-dark">
              {m.top_overdue.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <span className="font-mono text-xs text-gray-400">{o.id}</span>
                  <span className="flex-1 truncate text-sm font-medium">{o.customer}</span>
                  <Badge tone="red">{o.days_overdue}d</Badge>
                  <span className="w-24 text-right font-semibold">{aud.format(o.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-gray-400">
          <ChartBar className="h-3.5 w-3.5" /> Figures are computed live from your operational data.
        </p>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  const valueCls = danger ? "text-red-500" : accent ? "text-accent" : "";
  return (
    <div className="card p-5 hover:-translate-y-0.5 hover:shadow-glow">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${valueCls}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Gauge({
  label,
  value,
  ratio,
  hint,
  gold,
}: {
  label: string;
  value: string;
  ratio: number;
  hint?: string;
  gold?: boolean;
}) {
  const width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  return (
    <div className="card p-5 hover:-translate-y-0.5 hover:shadow-glow">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className={`h-full rounded-full ${gold ? "bg-gold" : "bg-accent"}`} style={{ width }} />
      </div>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function RevenueChart({ data }: { data: { label: string; collected: number; billed: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.collected, d.billed)));
  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-36 w-full items-end justify-center gap-1">
            <Bar height={(d.collected / max) * 100} className="bg-accent" title={`Collected: ${d.collected}`} />
            <Bar height={(d.billed / max) * 100} className="bg-gold" title={`Billed: ${d.billed}`} />
          </div>
          <span className="text-xs text-gray-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Bar({ height, className, title }: { height: number; className: string; title: string }) {
  return (
    <div
      title={title}
      className={`w-1/2 max-w-[18px] rounded-t-md transition-all duration-500 ${className}`}
      style={{ height: `${Math.max(2, height)}%` }}
    />
  );
}

function JobFunnel({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const order = ["quote_requested", "scheduled", "in_progress", "completed"];
  const rows = order.filter((s) => byStatus[s]).map((s) => ({ status: s, count: byStatus[s] }));
  // include any other statuses not in the canonical order
  Object.keys(byStatus)
    .filter((s) => !order.includes(s))
    .forEach((s) => rows.push({ status: s, count: byStatus[s] }));

  if (rows.length === 0) return <p className="py-6 text-center text-sm text-gray-400">No jobs yet.</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.status}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
              {STATUS_LABELS[r.status] ?? r.status}
            </Badge>
            <span className="font-semibold">{r.count}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-brand-gradient"
              style={{ width: `${total ? (r.count / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
