import { useEffect, useState } from "react";
import { opsApi } from "../api/endpoints";
import { apiError } from "../api/client";
import type { Customer, Invoice, Job, Message, Quote } from "../api/types";
import { exportInvoicePdf, exportQuotePdf } from "../lib/pdf";
import { Badge, Button, Spin } from "./ui";
import { Plus, Refresh } from "./icons";
import { DataFormModal, type Entity } from "./DataFormModal";

export type DataTab = Entity;

interface Data {
  jobs: Job[];
  invoices: Invoice[];
  quotes: Quote[];
  messages: Message[];
  customers: Customer[];
}

type AnyRecord = Job | Invoice | Quote | Message | Customer;

const STATUS_TONE: Record<string, string> = {
  completed: "green",
  paid: "green",
  approved: "green",
  in_progress: "blue",
  scheduled: "blue",
  sent: "blue",
  quote_requested: "amber",
  unpaid: "amber",
  draft: "neutral",
  rejected: "red",
  high: "red",
  medium: "amber",
  low: "neutral",
};

const TITLES: Record<DataTab, string> = {
  jobs: "Jobs",
  invoices: "Invoices",
  quotes: "Quotes",
  messages: "Messages",
  customers: "Customers",
};

// Add (create) is only supported for these entities.
const CREATABLE: DataTab[] = ["jobs", "invoices", "customers"];

interface ModalState {
  open: boolean;
  mode: "create" | "edit";
  record: AnyRecord | null;
}

export function DataView({ tab }: { tab: DataTab }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: "create", record: null });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [jobs, invoices, quotes, messages, customers] = await Promise.all([
        opsApi.jobs(),
        opsApi.invoices(),
        opsApi.quotes(),
        opsApi.messages(),
        opsApi.customers(),
      ]);
      setData({ jobs, invoices, quotes, messages, customers });
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

  const openCreate = () => setModal({ open: true, mode: "create", record: null });
  const openEdit = (record: AnyRecord) => setModal({ open: true, mode: "edit", record });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  const isEmpty =
    data &&
    data.jobs.length === 0 &&
    data.invoices.length === 0 &&
    data.customers.length === 0;

  const count = data ? data[tab].length : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-edge-light px-4 py-2.5 dark:border-edge-dark md:px-6">
        <h2 className="text-sm font-semibold">
          {TITLES[tab]}
          {data && <span className="ml-1.5 text-gray-400">({count})</span>}
        </h2>
        <p className="hidden text-xs text-gray-400 sm:block">· Click any entry to edit</p>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={load} className="px-2.5 py-1.5" aria-label="Refresh">
            <Refresh className="h-4 w-4" />
          </Button>
          {CREATABLE.includes(tab) && (
            <Button onClick={openCreate} className="py-1.5">
              <Plus className="h-4 w-4" /> Add
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <Spin />
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <>
            {isEmpty && (
              <div className="card mb-4 flex flex-col items-center gap-3 p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This account has no data yet. Load the sample dataset to explore, or add your own.
                </p>
                <Button onClick={loadSample} loading={busy}>
                  Load sample data
                </Button>
              </div>
            )}
            {data && <TabContent tab={tab} data={data} onEdit={openEdit} />}
          </>
        )}
      </div>

      {data && (
        <DataFormModal
          open={modal.open}
          onClose={closeModal}
          entity={tab}
          mode={modal.mode}
          record={modal.record}
          customers={data.customers}
          onSaved={() => {
            closeModal();
            load();
          }}
        />
      )}
    </div>
  );
}

function tone(v: string) {
  return STATUS_TONE[v] ?? "neutral";
}

function TabContent({
  tab,
  data,
  onEdit,
}: {
  tab: DataTab;
  data: Data;
  onEdit: (r: AnyRecord) => void;
}) {
  if (tab === "jobs")
    return (
      <Table
        head={["ID", "Title", "Customer", "Status", "Priority", "Scheduled", "Tech"]}
        rows={data.jobs.map((j) => ({
          key: j.id,
          onClick: () => onEdit(j),
          cells: [
            <span className="font-mono text-xs">{j.id}</span>,
            j.title,
            j.customer,
            <Badge tone={tone(j.status)}>{j.status}</Badge>,
            <Badge tone={tone(j.priority)}>{j.priority}</Badge>,
            j.scheduled_date ?? "—",
            j.assigned_tech ?? "—",
          ],
        }))}
      />
    );

  if (tab === "invoices")
    return (
      <Table
        head={["ID", "Customer", "Amount", "Due", "Status", "Overdue", ""]}
        rows={data.invoices.map((i) => ({
          key: i.id,
          onClick: () => onEdit(i),
          cells: [
            <span className="font-mono text-xs">{i.id}</span>,
            i.customer,
            `$${i.amount.toFixed(2)}`,
            i.due_date ?? "—",
            <Badge tone={tone(i.status)}>{i.status}</Badge>,
            i.overdue ? <Badge tone="red">{i.days_overdue}d overdue</Badge> : "—",
            <PdfButton
              onClick={() =>
                exportInvoicePdf(
                  i,
                  data.customers.find((c) => c.id === i.customer_id),
                )
              }
            />,
          ],
        }))}
      />
    );

  if (tab === "customers")
    return (
      <Table
        head={["ID", "Name", "Contact", "Phone", "Site"]}
        rows={data.customers.map((c) => ({
          key: c.id,
          onClick: () => onEdit(c),
          cells: [
            <span className="font-mono text-xs">{c.id}</span>,
            c.name,
            c.contact,
            c.phone,
            <span className="text-xs text-gray-500">{c.site_address}</span>,
          ],
        }))}
      />
    );

  if (tab === "quotes")
    return (
      <div className="space-y-3">
        {data.quotes.length === 0 && <Empty label="No quotes yet. Ask the agent to draft one." />}
        {data.quotes.map((q) => (
          <div
            key={q.id}
            className="card cursor-pointer p-4 transition hover:border-accent"
            onClick={() => onEdit(q)}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-xs">{q.id}</span>
              <span className="font-semibold">{q.customer}</span>
              <Badge tone={tone(q.status)}>{q.status}</Badge>
              <span className="ml-auto font-semibold text-accent">${q.total.toFixed(2)} inc GST</span>
              <PdfButton
                onClick={(e) => {
                  e.stopPropagation();
                  exportQuotePdf(q);
                }}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {q.line_items.map((li, i) => (
                    <tr key={i} className="border-t border-edge-light dark:border-edge-dark">
                      <td className="py-1">{li.description}</td>
                      <td className="py-1 text-right">{li.qty}</td>
                      <td className="py-1 text-right">${li.unit_price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Labour {q.labour_hours}h · materials ${q.materials_total.toFixed(2)} · GST $
              {q.gst.toFixed(2)}
            </p>
            {q.notes && <p className="mt-1 text-xs text-gray-400">{q.notes}</p>}
          </div>
        ))}
      </div>
    );

  // messages
  return (
    <div className="space-y-3">
      {data.messages.length === 0 && <Empty label="No messages yet. Ask the agent to draft one." />}
      {data.messages.map((m) => (
        <div
          key={m.id}
          className="card cursor-pointer p-4 transition hover:border-accent"
          onClick={() => onEdit(m)}
        >
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span className="font-mono">{m.id}</span>
            <Badge tone="blue">{m.purpose}</Badge>
            <span className="text-gray-400">re {m.reference_id}</span>
            <Badge tone={tone(m.status)}>{m.status}</Badge>
          </div>
          <p className="text-sm">{m.body}</p>
        </div>
      ))}
    </div>
  );
}

function PdfButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-edge-light px-2 py-1 text-xs font-medium text-gray-500 transition hover:border-accent hover:text-accent dark:border-edge-dark"
      title="Export as PDF"
    >
      PDF
    </button>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-gray-400">{label}</p>;
}

interface Row {
  key: string;
  cells: React.ReactNode[];
  onClick?: () => void;
}

function Table({ head, rows }: { head: string[]; rows: Row[] }) {
  if (rows.length === 0) return <Empty label="Nothing here yet." />;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-edge-light text-xs uppercase tracking-wide text-gray-400 dark:border-edge-dark">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              onClick={r.onClick}
              className={`border-b border-edge-light last:border-0 dark:border-edge-dark ${
                r.onClick ? "cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]" : ""
              }`}
            >
              {r.cells.map((cell, j) => (
                <td key={j} className="px-4 py-2.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
