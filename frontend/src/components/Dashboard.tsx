import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { opsApi } from "../api/endpoints";
import { apiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Customer, Invoice, Job, Metrics, Quote } from "../api/types";
import type { View } from "../lib/nav";
import { CATEGORY, CATEGORY_RGB, JOB_STATUS_COLORS } from "../lib/theme";
import { Badge, Button, Spin } from "./ui";
import { Aurora } from "./Aurora";
import { Particles } from "./Particles";
import { MagicCard, NumberTicker } from "./magic";
import { DetailModal, type DetailField } from "./DetailModal";
import { ArrowRight, ChartBar } from "./icons";

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const aud2 = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const money = (n: number) => aud.format(n);
const pct = (n: number) => `${Math.round(n * 100)}%`;

const STATUS_LABELS: Record<string, string> = {
  quote_requested: "Quote requested",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
};
const STATUS_TONE: Record<string, string> = {
  completed: "green",
  paid: "green",
  approved: "green",
  in_progress: "blue",
  scheduled: "blue",
  quote_requested: "amber",
  unpaid: "amber",
  draft: "neutral",
};

interface DetailConfig {
  title: string;
  subtitle?: ReactNode;
  accent: string;
  fields: DetailField[];
  summaryTitle: string;
  summaryContext: unknown;
  subjectType: string;
  subjectRef?: string;
}

interface Props {
  onNavigate: (v: View) => void;
  provider: string;
  model: string;
}

export function Dashboard({ onNavigate, provider, model }: Props) {
  const { user } = useAuth();
  const [m, setM] = useState<Metrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<DetailConfig | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [metrics, inv, qs, js, cs] = await Promise.all([
        opsApi.metrics(),
        opsApi.invoices(),
        opsApi.quotes(),
        opsApi.jobs(),
        opsApi.customers(),
      ]);
      setM(metrics);
      setInvoices(inv);
      setQuotes(qs);
      setJobs(js);
      setCustomers(cs);
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

  // Recent slices (most recent first).
  const recentInvoices = useMemo(
    () => [...invoices].sort((a, b) => (b.issued_date ?? "").localeCompare(a.issued_date ?? "")).slice(0, 5),
    [invoices],
  );
  const recentQuotes = useMemo(() => [...quotes].reverse().slice(0, 5), [quotes]);
  const recentJobs = useMemo(() => [...jobs].reverse().slice(0, 5), [jobs]);
  const newCustomers = useMemo(() => [...customers].reverse().slice(0, 5), [customers]);

  if (loading) return <Spin />;
  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>;
  if (!m) return null;

  const isEmpty = m.invoices_total === 0 && m.customers_total === 0 && m.jobs_total === 0;

  // --- detail openers ----------------------------------------------------
  const openInvoice = (i: Invoice) => {
    const gst = +(i.amount * 0.1).toFixed(2);
    setDetail({
      title: `Invoice ${i.id}`,
      subtitle: i.customer,
      accent: CATEGORY_RGB.invoices,
      summaryTitle: `Invoice ${i.id} for ${i.customer}`,
      summaryContext: i,
      subjectType: "invoice",
      subjectRef: i.id,
      fields: [
        { label: "Customer", value: i.customer },
        { label: "Status", value: <Badge tone={STATUS_TONE[i.status] ?? "neutral"}>{i.status}</Badge> },
        { label: "Amount (ex GST)", value: aud2.format(i.amount) },
        { label: "GST (10%)", value: aud2.format(gst) },
        { label: "Total", value: aud2.format(i.amount + gst) },
        { label: "Job", value: i.job_id ?? "—" },
        { label: "Issued", value: i.issued_date ?? "—" },
        { label: "Due", value: i.due_date ?? "—" },
        { label: "Overdue", value: i.overdue ? `${i.days_overdue} days` : "No" },
      ],
    });
  };

  const openQuote = (q: Quote) =>
    setDetail({
      title: `Quote ${q.id}`,
      subtitle: q.customer,
      accent: CATEGORY_RGB.quotes,
      summaryTitle: `Quote ${q.id} for ${q.customer}`,
      summaryContext: q,
      subjectType: "quote",
      subjectRef: q.id,
      fields: [
        { label: "Customer", value: q.customer },
        { label: "Status", value: <Badge tone={STATUS_TONE[q.status] ?? "neutral"}>{q.status}</Badge> },
        { label: "Job", value: q.job_id || "—" },
        { label: "Line items", value: String(q.line_items.length) },
        { label: "Materials", value: aud2.format(q.materials_total) },
        { label: "Labour", value: `${q.labour_hours}h · ${aud2.format(q.labour_total)}` },
        { label: "Subtotal", value: aud2.format(q.subtotal) },
        { label: "GST", value: aud2.format(q.gst) },
        { label: "Total", value: aud2.format(q.total) },
        ...(q.notes ? [{ label: "Notes", value: q.notes, wide: true }] : []),
      ],
    });

  const openJob = (j: Job) =>
    setDetail({
      title: `Job ${j.id}`,
      subtitle: j.title,
      accent: CATEGORY_RGB.jobs,
      summaryTitle: `Job ${j.id} — ${j.title}`,
      summaryContext: j,
      subjectType: "job",
      subjectRef: j.id,
      fields: [
        { label: "Title", value: j.title, wide: true },
        { label: "Customer", value: j.customer },
        { label: "Status", value: <Badge tone={STATUS_TONE[j.status] ?? "neutral"}>{j.status}</Badge> },
        { label: "Priority", value: <Badge tone={j.priority === "high" ? "red" : j.priority === "medium" ? "amber" : "neutral"}>{j.priority}</Badge> },
        { label: "Scheduled", value: j.scheduled_date ?? "—" },
        { label: "Tech", value: j.assigned_tech ?? "—" },
      ],
    });

  const openCustomer = (c: Customer) =>
    setDetail({
      title: c.name,
      subtitle: c.id,
      accent: CATEGORY_RGB.customers,
      summaryTitle: `Customer ${c.name}`,
      summaryContext: c,
      subjectType: "customer",
      subjectRef: c.id,
      fields: [
        { label: "Contact", value: c.contact || "—" },
        { label: "Phone", value: c.phone || "—" },
        { label: "Email", value: c.email || "—", wide: true },
        { label: "Site", value: c.site_address || "—", wide: true },
      ],
    });

  const openMetric = (cfg: DetailConfig) => setDetail(cfg);

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
          <StatCard
            label="Revenue collected"
            value={m.revenue_collected}
            format={money}
            rgb={CATEGORY_RGB.revenue}
            tone="text-cat-revenue"
            sub={`${m.invoices_paid} paid invoices`}
            onClick={() =>
              openMetric({
                title: "Revenue collected",
                accent: CATEGORY_RGB.revenue,
                subjectType: "metric",
                summaryTitle: "Revenue & collections overview",
                summaryContext: {
                  revenue_collected: m.revenue_collected,
                  billed_total: m.billed_total,
                  outstanding: m.outstanding,
                  collection_rate: m.collection_rate,
                  invoices_paid: m.invoices_paid,
                  avg_invoice: m.avg_invoice,
                },
                fields: [
                  { label: "Collected", value: aud2.format(m.revenue_collected) },
                  { label: "Billed total", value: aud2.format(m.billed_total) },
                  { label: "Outstanding", value: aud2.format(m.outstanding) },
                  { label: "Collection rate", value: pct(m.collection_rate) },
                  { label: "Paid invoices", value: String(m.invoices_paid) },
                  { label: "Avg invoice", value: aud2.format(m.avg_invoice) },
                ],
              })
            }
          />
          <StatCard
            label="Outstanding"
            value={m.outstanding}
            format={money}
            rgb={CATEGORY_RGB.quotes}
            sub={`${m.invoices_unpaid} unpaid`}
            onClick={() =>
              openMetric({
                title: "Outstanding balance",
                accent: CATEGORY_RGB.quotes,
                subjectType: "metric",
                summaryTitle: "Outstanding & overdue position",
                summaryContext: {
                  outstanding: m.outstanding,
                  invoices_unpaid: m.invoices_unpaid,
                  overdue_amount: m.overdue_amount,
                  overdue_count: m.overdue_count,
                  top_overdue: m.top_overdue,
                },
                fields: [
                  { label: "Outstanding", value: aud2.format(m.outstanding) },
                  { label: "Unpaid invoices", value: String(m.invoices_unpaid) },
                  { label: "Overdue amount", value: aud2.format(m.overdue_amount) },
                  { label: "Overdue count", value: String(m.overdue_count) },
                ],
              })
            }
          />
          <StatCard
            label="Overdue"
            value={m.overdue_amount}
            format={money}
            rgb="239,68,68"
            tone="text-cat-danger"
            sub={`${m.overdue_count} ${m.overdue_count === 1 ? "invoice" : "invoices"} past due`}
            onClick={() =>
              openMetric({
                title: "Overdue invoices",
                accent: "239,68,68",
                subjectType: "metric",
                summaryTitle: "Overdue invoices & recovery actions",
                summaryContext: { overdue_amount: m.overdue_amount, overdue_count: m.overdue_count, top_overdue: m.top_overdue },
                fields: [
                  { label: "Overdue amount", value: aud2.format(m.overdue_amount) },
                  { label: "Overdue count", value: String(m.overdue_count) },
                  {
                    label: "Worst offenders",
                    wide: true,
                    value: (
                      <ul className="mt-1 space-y-1">
                        {m.top_overdue.map((o) => (
                          <li key={o.id} className="flex justify-between gap-2 text-xs">
                            <span>{o.customer}</span>
                            <span className="text-gray-400">{o.days_overdue}d · {aud2.format(o.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ],
              })
            }
          />
          <StatCard
            label="Active jobs"
            value={m.active_jobs}
            format={(n) => String(Math.round(n))}
            rgb={CATEGORY_RGB.jobs}
            tone="text-cat-jobs"
            sub={`${m.high_priority_jobs} high priority`}
            onClick={() =>
              openMetric({
                title: "Active jobs",
                accent: CATEGORY_RGB.jobs,
                subjectType: "metric",
                summaryTitle: "Job pipeline overview",
                summaryContext: { jobs_total: m.jobs_total, active_jobs: m.active_jobs, high_priority_jobs: m.high_priority_jobs, jobs_by_status: m.jobs_by_status },
                fields: [
                  { label: "Total jobs", value: String(m.jobs_total) },
                  { label: "Active", value: String(m.active_jobs) },
                  { label: "High priority", value: String(m.high_priority_jobs) },
                  {
                    label: "By status",
                    wide: true,
                    value: (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {Object.entries(m.jobs_by_status).map(([s, n]) => (
                          <Badge key={s} tone={STATUS_TONE[s] ?? "neutral"}>
                            {STATUS_LABELS[s] ?? s}: {n}
                          </Badge>
                        ))}
                      </div>
                    ),
                  },
                ],
              })
            }
          />
        </div>

        {/* Secondary metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Gauge label="Collection rate" value={pct(m.collection_rate)} ratio={m.collection_rate} hint="of billed revenue received" />
          <Gauge label="Customer retention" value={pct(m.repeat_rate)} ratio={m.repeat_rate} gold hint={`${m.repeat_customers} repeat customers`} />
          <StatCard
            label="Quote pipeline"
            value={m.quote_pipeline}
            format={money}
            rgb={CATEGORY_RGB.quotes}
            sub={`${m.quotes_count} quotes drafted`}
            onClick={() =>
              openMetric({
                title: "Quote pipeline",
                accent: CATEGORY_RGB.quotes,
                subjectType: "metric",
                summaryTitle: "Quote pipeline overview",
                summaryContext: {
                  quote_pipeline: m.quote_pipeline,
                  quotes_count: m.quotes_count,
                  recent_quotes: recentQuotes.map((q) => ({ id: q.id, customer: q.customer, total: q.total, status: q.status })),
                },
                fields: [
                  { label: "Pipeline value", value: aud2.format(m.quote_pipeline) },
                  { label: "Quotes drafted", value: String(m.quotes_count) },
                  {
                    label: "Recent quotes",
                    wide: true,
                    value: (
                      <ul className="mt-1 space-y-1">
                        {recentQuotes.map((q) => (
                          <li key={q.id} className="flex justify-between gap-2 text-xs">
                            <span>{q.customer}</span>
                            <span className="text-gray-400">{aud2.format(q.total)} · {q.status}</span>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ],
              })
            }
          />
          <StatCard
            label="Avg invoice"
            value={m.avg_invoice}
            format={money}
            rgb={CATEGORY_RGB.customers}
            sub={`${m.customers_total} customers · ${m.active_customers} active`}
            onClick={() =>
              openMetric({
                title: "Average invoice & customers",
                accent: CATEGORY_RGB.customers,
                subjectType: "metric",
                summaryTitle: "Average invoice value & customer base",
                summaryContext: {
                  avg_invoice: m.avg_invoice,
                  billed_total: m.billed_total,
                  invoices_total: m.invoices_total,
                  customers_total: m.customers_total,
                  active_customers: m.active_customers,
                  repeat_customers: m.repeat_customers,
                  repeat_rate: m.repeat_rate,
                },
                fields: [
                  { label: "Avg invoice", value: aud2.format(m.avg_invoice) },
                  { label: "Billed total", value: aud2.format(m.billed_total) },
                  { label: "Invoices", value: String(m.invoices_total) },
                  { label: "Customers", value: String(m.customers_total) },
                  { label: "Active customers", value: String(m.active_customers) },
                  { label: "Repeat rate", value: pct(m.repeat_rate) },
                ],
              })
            }
          />
        </div>

        {/* Charts: revenue trend + invoice status donut */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Revenue trend</h2>
                <p className="text-xs text-gray-500">Collected vs billed, last 6 months (AUD)</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <Legend color={CATEGORY.revenue} label="Collected" />
                <Legend color={CATEGORY.billed} label="Billed" />
              </div>
            </div>
            <RevenueArea data={m.revenue_by_month} />
          </div>

          <div className="card p-5">
            <h2 className="mb-1 font-semibold">Invoice status</h2>
            <p className="mb-2 text-xs text-gray-500">{m.invoices_total} invoices</p>
            <InvoiceDonut paid={m.invoices_paid} unpaid={m.invoices_unpaid - m.overdue_count} overdue={m.overdue_count} />
          </div>
        </div>

        {/* Jobs by status bar + Top overdue */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5">
            <h2 className="mb-1 font-semibold">Jobs by status</h2>
            <p className="mb-3 text-xs text-gray-500">{m.jobs_total} jobs total</p>
            <JobsBar byStatus={m.jobs_by_status} />
          </div>

          <div className="card p-5 lg:col-span-2">
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
                {m.top_overdue.map((o) => {
                  const inv = invoices.find((i) => i.id === o.id);
                  return (
                    <li
                      key={o.id}
                      onClick={() => inv && openInvoice(inv)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    >
                      <span className="font-mono text-xs text-gray-400">{o.id}</span>
                      <span className="flex-1 truncate text-sm font-medium">{o.customer}</span>
                      <Badge tone="red">{o.days_overdue}d</Badge>
                      <span className="w-24 text-right font-semibold">{money(o.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentList title="Recent invoices" rgb={CATEGORY.invoices} onMore={() => onNavigate("invoices")} empty="No invoices yet.">
            {recentInvoices.map((i) => (
              <RecentRow key={i.id} onClick={() => openInvoice(i)} id={i.id} main={i.customer} right={money(i.amount)} badge={<Badge tone={i.overdue ? "red" : STATUS_TONE[i.status] ?? "neutral"}>{i.overdue ? "overdue" : i.status}</Badge>} />
            ))}
          </RecentList>

          <RecentList title="Recent quotes" rgb={CATEGORY.quotes} onMore={() => onNavigate("quotes")} empty="No quotes yet.">
            {recentQuotes.map((q) => (
              <RecentRow key={q.id} onClick={() => openQuote(q)} id={q.id} main={q.customer} right={money(q.total)} badge={<Badge tone={STATUS_TONE[q.status] ?? "neutral"}>{q.status}</Badge>} />
            ))}
          </RecentList>

          <RecentList title="Recent jobs" rgb={CATEGORY.jobs} onMore={() => onNavigate("jobs")} empty="No jobs yet.">
            {recentJobs.map((j) => (
              <RecentRow key={j.id} onClick={() => openJob(j)} id={j.id} main={j.title} sub={j.customer} badge={<Badge tone={STATUS_TONE[j.status] ?? "neutral"}>{STATUS_LABELS[j.status] ?? j.status}</Badge>} />
            ))}
          </RecentList>

          <RecentList title="New customers" rgb={CATEGORY.customers} onMore={() => onNavigate("customers")} empty="No customers yet.">
            {newCustomers.map((c) => (
              <RecentRow key={c.id} onClick={() => openCustomer(c)} id={c.id} main={c.name} sub={c.contact || c.email} />
            ))}
          </RecentList>
        </div>

        <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-gray-400">
          <ChartBar className="h-3.5 w-3.5" /> Figures are computed live from your operational data · click any card for an AI summary.
        </p>
      </div>

      {detail && (
        <DetailModal
          open
          onClose={() => setDetail(null)}
          title={detail.title}
          subtitle={detail.subtitle}
          accent={detail.accent}
          fields={detail.fields}
          summaryTitle={detail.summaryTitle}
          summaryContext={detail.summaryContext}
          subjectType={detail.subjectType}
          subjectRef={detail.subjectRef}
          provider={provider}
          model={model}
        />
      )}
    </div>
  );
}

// --- cards ----------------------------------------------------------------
function StatCard({
  label,
  value,
  format,
  sub,
  rgb,
  tone = "",
  onClick,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  sub?: string;
  rgb: string;
  tone?: string;
  onClick?: () => void;
}) {
  return (
    <MagicCard rgb={rgb} onClick={onClick} className={`card p-5 ${onClick ? "card-interactive" : ""}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: `rgb(${rgb})` }} />
      </div>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${tone}`}>
        <NumberTicker value={value} format={format} />
      </p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </MagicCard>
  );
}

function Gauge({ label, value, ratio, hint, gold }: { label: string; value: string; ratio: number; hint?: string; gold?: boolean }) {
  const width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className={`h-full rounded-full ${gold ? "bg-gold" : "bg-accent"}`} style={{ width }} />
      </div>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

// --- recent activity ------------------------------------------------------
function RecentList({ title, rgb, onMore, empty, children }: { title: string; rgb: string; onMore: () => void; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.filter(Boolean).length > 0;
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: rgb }} />
          {title}
        </h2>
        <button onClick={onMore} className="text-xs font-medium text-accent hover:underline">
          View all →
        </button>
      </div>
      {hasItems ? <div className="space-y-0.5">{children}</div> : <p className="py-6 text-center text-sm text-gray-400">{empty}</p>}
    </div>
  );
}

function RecentRow({ id, main, sub, right, badge, onClick }: { id: string; main: string; sub?: string; right?: ReactNode; badge?: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <span className="font-mono text-[11px] text-gray-400">{id}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{main}</span>
        {sub && <span className="block truncate text-xs text-gray-500">{sub}</span>}
      </span>
      {badge}
      {right && <span className="text-sm font-semibold">{right}</span>}
    </button>
  );
}

// --- charts ---------------------------------------------------------------
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-edge-light bg-panel-light px-3 py-2 text-xs shadow-card-lg dark:border-edge-dark dark:bg-panel-dark">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5" style={{ color: p.color || p.payload?.fill }}>
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: {typeof p.value === "number" ? aud.format(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

function RevenueArea({ data }: { data: { label: string; collected: number; billed: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CATEGORY.revenue} stopOpacity={0.45} />
            <stop offset="100%" stopColor={CATEGORY.revenue} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gBilled" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CATEGORY.billed} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CATEGORY.billed} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        <Tooltip content={<ChartTip />} />
        <Area type="monotone" dataKey="billed" name="Billed" stroke={CATEGORY.billed} strokeWidth={2} fill="url(#gBilled)" />
        <Area type="monotone" dataKey="collected" name="Collected" stroke={CATEGORY.revenue} strokeWidth={2.5} fill="url(#gCollected)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function InvoiceDonut({ paid, unpaid, overdue }: { paid: number; unpaid: number; overdue: number }) {
  const data = [
    { name: "Paid", value: paid, fill: CATEGORY.paid },
    { name: "Unpaid", value: Math.max(0, unpaid), fill: CATEGORY.unpaid },
    { name: "Overdue", value: overdue, fill: CATEGORY.danger },
  ].filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="py-10 text-center text-sm text-gray-400">No invoices yet.</p>;
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip content={<ChartTip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{total}</span>
        <span className="text-[11px] text-gray-400">invoices</span>
      </div>
      <div className="mt-1 flex justify-center gap-3 text-xs text-gray-500">
        {data.map((d) => (
          <Legend key={d.name} color={d.fill} label={`${d.name} ${d.value}`} />
        ))}
      </div>
    </div>
  );
}

function JobsBar({ byStatus }: { byStatus: Record<string, number> }) {
  const order = ["quote_requested", "scheduled", "in_progress", "completed"];
  const data = [
    ...order.filter((s) => byStatus[s]).map((s) => ({ status: s, label: STATUS_LABELS[s] ?? s, count: byStatus[s] })),
    ...Object.keys(byStatus)
      .filter((s) => !order.includes(s))
      .map((s) => ({ status: s, label: s, count: byStatus[s] })),
  ];
  if (data.length === 0) return <p className="py-10 text-center text-sm text-gray-400">No jobs yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={88} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
        <Bar dataKey="count" name="Jobs" radius={[4, 4, 4, 4]} barSize={16}>
          {data.map((d, i) => (
            <Cell key={i} fill={JOB_STATUS_COLORS[d.status] ?? CATEGORY.neutral} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
