import { useEffect, useMemo, useState } from "react";
import { opsApi } from "../api/endpoints";
import { apiError } from "../api/client";
import type { Customer, Invoice, Job, Message, Quote } from "../api/types";
import { exportInvoicePdf, exportQuotePdf } from "../lib/pdf";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { Plus, Trash } from "./icons";

export type Entity = "jobs" | "invoices" | "customers" | "quotes" | "messages";
type Mode = "create" | "edit";

interface Props {
  open: boolean;
  onClose: () => void;
  entity: Entity;
  mode: Mode;
  record?: Job | Invoice | Customer | Quote | Message | null;
  customers: Customer[];
  onSaved: () => void;
}

type LineItem = { description: string; qty: number; unit_price: number };
type FormState = Record<string, string>;

const TITLES: Record<Entity, { create: string; edit: string }> = {
  jobs: { create: "Add job", edit: "Edit job" },
  invoices: { create: "Add invoice", edit: "Edit invoice" },
  customers: { create: "Add customer", edit: "Edit customer" },
  quotes: { create: "Add quote", edit: "Edit quote" },
  messages: { create: "Add message", edit: "Edit message" },
};

// Empty string in a nullable field means "clear it".
const nz = (v: string | undefined) => (v && v.trim() ? v : null);

// ---- Module-level field components ----------------------------------------
// Defined OUTSIDE the modal component so their identity is stable across
// renders. Previously these lived inside the component, so every keystroke
// created a brand-new component type and React remounted the <input>, stealing
// focus after each character. Hoisting them fixes that.

function Field({
  label,
  value,
  onChange,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <textarea
        className="input resize-y"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function CustomerSelect({
  value,
  onChange,
  customers,
}: {
  value: string;
  onChange: (v: string) => void;
  customers: Customer[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Customer</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Select a customer…</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id} — {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Seed form state from an existing record (edit) or sensible defaults (create).
function seedForm(entity: Entity, record: Props["record"]): FormState {
  const r = (record ?? {}) as Record<string, unknown>;
  const s = (k: string) => (r[k] == null ? "" : String(r[k]));
  switch (entity) {
    case "customers":
      return { name: s("name"), contact: s("contact"), email: s("email"), phone: s("phone"), site_address: s("site_address") };
    case "jobs":
      return {
        customer_ref: s("customer_id"),
        title: s("title"),
        status: s("status") || "quote_requested",
        priority: s("priority") || "medium",
        scheduled_date: s("scheduled_date"),
        assigned_tech: s("assigned_tech"),
      };
    case "invoices":
      return {
        customer_ref: s("customer_id"),
        job_ref: s("job_id"),
        amount: s("amount"),
        issued_date: s("issued_date"),
        due_date: s("due_date"),
        status: s("status") || "unpaid",
      };
    case "quotes":
      return {
        labour_hours: s("labour_hours"),
        status: s("status") || "draft",
        notes: s("notes"),
      };
    case "messages":
      return {
        reference_id: s("reference_id"),
        purpose: s("purpose") || "general",
        body: s("body"),
        status: s("status") || "draft",
      };
  }
}

const seedItems = (record: Props["record"]): LineItem[] =>
  ((record as Quote | undefined)?.line_items as LineItem[] | undefined) ?? [];

export function DataFormModal({ open, onClose, entity, mode, record, customers, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => seedForm(entity, record));
  const [items, setItems] = useState<LineItem[]>(() => seedItems(record));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Re-seed whenever the modal opens for a different record/entity/mode.
  useEffect(() => {
    if (open) {
      setForm(seedForm(entity, record));
      setItems(seedItems(record));
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entity, mode, record]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const customer = useMemo(
    () => customers.find((c) => c.id === (record as Invoice | undefined)?.customer_id),
    [customers, record],
  );

  const buildPayload = (): Record<string, unknown> => {
    switch (entity) {
      case "customers":
        return {
          name: form.name,
          contact: form.contact || "",
          email: form.email || "",
          phone: form.phone || "",
          site_address: form.site_address || "",
        };
      case "jobs":
        return {
          customer_ref: form.customer_ref,
          title: form.title,
          status: form.status || "quote_requested",
          priority: form.priority || "medium",
          scheduled_date: nz(form.scheduled_date),
          assigned_tech: nz(form.assigned_tech),
        };
      case "invoices":
        return {
          customer_ref: form.customer_ref,
          job_ref: nz(form.job_ref),
          amount: parseFloat(form.amount || "0"),
          issued_date: nz(form.issued_date),
          due_date: nz(form.due_date),
          status: form.status || "unpaid",
        };
      case "quotes":
        return {
          line_items: items.map((li) => ({
            description: li.description,
            qty: Number(li.qty) || 0,
            unit_price: Number(li.unit_price) || 0,
          })),
          labour_hours: parseFloat(form.labour_hours || "0"),
          notes: form.notes || "",
          status: form.status || "draft",
        };
      case "messages":
        return {
          reference_id: form.reference_id || "",
          purpose: form.purpose || "general",
          body: form.body || "",
          status: form.status || "draft",
        };
    }
  };

  // Persist; returns the saved record (used by export-after-save).
  const save = async (): Promise<Job | Invoice | Customer | Quote | Message> => {
    const payload = buildPayload();
    const ref = (record as { id: string } | undefined)?.id ?? "";
    if (mode === "create") {
      if (entity === "customers") return opsApi.createCustomer(payload);
      if (entity === "jobs") return opsApi.createJob(payload);
      return opsApi.createInvoice(payload);
    }
    switch (entity) {
      case "customers":
        return opsApi.updateCustomer(ref, payload);
      case "jobs":
        return opsApi.updateJob(ref, payload);
      case "invoices":
        return opsApi.updateInvoice(ref, payload);
      case "quotes":
        return opsApi.updateQuote(ref, payload);
      case "messages":
        return opsApi.updateMessage(ref, payload);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await save();
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  // Save the current edits, then open a print-ready PDF of the fresh record.
  const saveAndExport = async () => {
    setBusy(true);
    setError("");
    try {
      const saved = await save();
      if (entity === "invoices") exportInvoicePdf(saved as Invoice, customer);
      else if (entity === "quotes") exportQuotePdf(saved as Quote);
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    const ref = (record as { id: string } | undefined)?.id;
    if (!ref || !window.confirm(`Delete ${ref}? It will be archived and hidden from all views.`)) return;
    setBusy(true);
    setError("");
    try {
      await opsApi.remove(entity, ref);
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const canExport = mode === "edit" && (entity === "invoices" || entity === "quotes");

  return (
    <Modal open={open} onClose={onClose} title={TITLES[entity][mode]}>
      <form onSubmit={submit} className="space-y-3">
        {entity === "customers" && (
          <>
            <Field label="Name" value={form.name} onChange={(v) => set("name", v)} required />
            <Field label="Contact person" value={form.contact} onChange={(v) => set("contact", v)} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
            <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
            <Field label="Site address" value={form.site_address} onChange={(v) => set("site_address", v)} />
          </>
        )}

        {entity === "jobs" && (
          <>
            {customers.length === 0 ? (
              <p className="text-sm text-amber-600">Add a customer first.</p>
            ) : (
              <CustomerSelect value={form.customer_ref} onChange={(v) => set("customer_ref", v)} customers={customers} />
            )}
            <Field label="Title" value={form.title} onChange={(v) => set("title", v)} required />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Status"
                value={form.status}
                onChange={(v) => set("status", v)}
                options={["quote_requested", "scheduled", "in_progress", "completed"]}
              />
              <SelectField
                label="Priority"
                value={form.priority}
                onChange={(v) => set("priority", v)}
                options={["low", "medium", "high"]}
              />
            </div>
            <Field label="Scheduled date" type="date" value={form.scheduled_date} onChange={(v) => set("scheduled_date", v)} />
            <Field label="Assigned tech" value={form.assigned_tech} onChange={(v) => set("assigned_tech", v)} />
          </>
        )}

        {entity === "invoices" && (
          <>
            {customers.length === 0 ? (
              <p className="text-sm text-amber-600">Add a customer first.</p>
            ) : (
              <CustomerSelect value={form.customer_ref} onChange={(v) => set("customer_ref", v)} customers={customers} />
            )}
            <Field label="Job ref (optional)" value={form.job_ref} onChange={(v) => set("job_ref", v)} placeholder="JOB-5001" />
            <Field label="Amount (ex-GST AUD)" type="number" step="0.01" value={form.amount} onChange={(v) => set("amount", v)} required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issued date" type="date" value={form.issued_date} onChange={(v) => set("issued_date", v)} />
              <Field label="Due date" type="date" value={form.due_date} onChange={(v) => set("due_date", v)} />
            </div>
            <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={["unpaid", "paid"]} />
          </>
        )}

        {entity === "quotes" && (
          <>
            <LineItemsEditor items={items} onChange={setItems} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Labour hours" type="number" step="0.5" value={form.labour_hours} onChange={(v) => set("labour_hours", v)} />
              <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={["draft", "approved", "rejected"]} />
            </div>
            <TextArea label="Notes" value={form.notes} onChange={(v) => set("notes", v)} rows={3} />
          </>
        )}

        {entity === "messages" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reference (job/invoice)" value={form.reference_id} onChange={(v) => set("reference_id", v)} />
              <Field label="Purpose" value={form.purpose} onChange={(v) => set("purpose", v)} />
            </div>
            <TextArea label="Body" value={form.body} onChange={(v) => set("body", v)} rows={6} />
            <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={["draft", "approved", "sent"]} />
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-2 pt-2">
          {mode === "edit" && (
            <Button type="button" variant="ghost" onClick={del} className="text-red-500 hover:text-red-600" disabled={busy}>
              <Trash className="h-4 w-4" /> Delete
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {canExport && (
              <Button type="button" variant="outline" onClick={saveAndExport} disabled={busy}>
                Save &amp; export PDF
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function LineItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (next: LineItem[]) => void }) {
  const update = (i: number, k: keyof LineItem, v: string) => {
    const next = items.slice();
    next[i] = { ...next[i], [k]: k === "description" ? v : Number(v) };
    onChange(next);
  };
  const add = () => onChange([...items, { description: "", qty: 1, unit_price: 0 }]);
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Line items</label>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-xs text-gray-400">No materials — add a line, or rely on labour only.</p>}
        {items.map((li, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input flex-1"
              placeholder="Description"
              value={li.description}
              onChange={(e) => update(i, "description", e.target.value)}
            />
            <input
              className="input w-16"
              type="number"
              step="0.1"
              placeholder="Qty"
              value={String(li.qty)}
              onChange={(e) => update(i, "qty", e.target.value)}
            />
            <input
              className="input w-24"
              type="number"
              step="0.01"
              placeholder="Unit $"
              value={String(li.unit_price)}
              onChange={(e) => update(i, "unit_price", e.target.value)}
            />
            <button type="button" onClick={() => remove(i)} aria-label="Remove line">
              <Trash className="h-4 w-4 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="btn-ghost mt-2 px-2 py-1 text-sm">
        <Plus className="h-4 w-4" /> Add line
      </button>
    </div>
  );
}
