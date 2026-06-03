import { useState } from "react";
import { opsApi } from "../api/endpoints";
import { apiError } from "../api/client";
import type { Customer } from "../api/types";
import { Modal } from "./Modal";
import { Button } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  tab: "jobs" | "invoices" | "customers";
  customers: Customer[];
  onSaved: () => void;
}

const titles = { jobs: "Add job", invoices: "Add invoice", customers: "Add customer" };

export function AddDataModal({ open, onClose, tab, customers, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (tab === "customers") {
        await opsApi.createCustomer({
          name: form.name,
          contact: form.contact || "",
          email: form.email || "",
          phone: form.phone || "",
          site_address: form.site_address || "",
        });
      } else if (tab === "jobs") {
        await opsApi.createJob({
          customer_ref: form.customer_ref,
          title: form.title,
          status: form.status || "quote_requested",
          priority: form.priority || "medium",
          scheduled_date: form.scheduled_date || null,
          assigned_tech: form.assigned_tech || null,
          description: form.description || "",
        });
      } else {
        await opsApi.createInvoice({
          customer_ref: form.customer_ref,
          job_ref: form.job_ref || null,
          amount: parseFloat(form.amount || "0"),
          due_date: form.due_date || null,
          status: form.status || "unpaid",
        });
      }
      setForm({});
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const Field = ({ k, label, ...rest }: { k: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input className="input" value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} {...rest} />
    </div>
  );

  const CustomerSelect = ({ k }: { k: string }) => (
    <div>
      <label className="mb-1 block text-sm font-medium">Customer</label>
      <select className="input" value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} required>
        <option value="">Select a customer…</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id} — {c.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={titles[tab]}>
      <form onSubmit={submit} className="space-y-3">
        {tab === "customers" && (
          <>
            <Field k="name" label="Name" required />
            <Field k="contact" label="Contact person" />
            <Field k="email" label="Email" type="email" />
            <Field k="phone" label="Phone" />
            <Field k="site_address" label="Site address" />
          </>
        )}
        {tab === "jobs" && (
          <>
            {customers.length === 0 ? (
              <p className="text-sm text-amber-600">Add a customer first.</p>
            ) : (
              <CustomerSelect k="customer_ref" />
            )}
            <Field k="title" label="Title" required />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <select className="input" value={form.status ?? "quote_requested"} onChange={(e) => set("status", e.target.value)}>
                  {["quote_requested", "scheduled", "in_progress", "completed"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Priority</label>
                <select className="input" value={form.priority ?? "medium"} onChange={(e) => set("priority", e.target.value)}>
                  {["low", "medium", "high"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <Field k="scheduled_date" label="Scheduled date" type="date" />
            <Field k="assigned_tech" label="Assigned tech" />
          </>
        )}
        {tab === "invoices" && (
          <>
            {customers.length === 0 ? (
              <p className="text-sm text-amber-600">Add a customer first.</p>
            ) : (
              <CustomerSelect k="customer_ref" />
            )}
            <Field k="amount" label="Amount (ex-GST AUD)" type="number" step="0.01" required />
            <Field k="due_date" label="Due date" type="date" />
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select className="input" value={form.status ?? "unpaid"} onChange={(e) => set("status", e.target.value)}>
                {["unpaid", "paid"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
