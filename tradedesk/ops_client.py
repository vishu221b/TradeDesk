"""The operations backend — the agent's integration boundary.

Originally a JSON-file mock; now a SQLAlchemy-backed store, **scoped to a single
user**. Every read and write is filtered by ``user_id`` so accounts never see or
touch each other's jobs, invoices, quotes or messages. The method names and
return shapes are unchanged from the original mock, so the tool layer and agent
loop above it did not change when the storage moved to a database.

To run against a real field-service platform, replace this class with one that
calls that platform's API behind the same method names — nothing above changes.
"""

from __future__ import annotations

from datetime import date
from collections import Counter, defaultdict
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models

LABOUR_RATE_PER_HOUR = 95.00  # standard charge-out rate, ex GST
GST_RATE = 0.10               # Australian GST

_MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


class OpsClient:
    def __init__(self, db: Session, user_id: int, today: Optional[date] = None):
        self.db = db
        self.user_id = user_id
        self._today = today or date.today()

    # --- internal helpers ------------------------------------------------
    def _customers(self) -> list[models.Customer]:
        return list(
            self.db.scalars(
                select(models.Customer).where(
                    models.Customer.user_id == self.user_id,
                    models.Customer.is_active.is_(True),
                )
            )
        )

    def _customer_name(self, customer_ref: str) -> str:
        c = self.db.scalar(
            select(models.Customer).where(
                models.Customer.user_id == self.user_id,
                models.Customer.ref == customer_ref,
                models.Customer.is_active.is_(True),
            )
        )
        return c.name if c else customer_ref

    def _is_overdue(self, inv: models.Invoice) -> bool:
        if inv.status != "unpaid" or not inv.due_date:
            return False
        return date.fromisoformat(inv.due_date) < self._today

    def _next_ref(self, model, prefix: str, base: int) -> str:
        """Generate the next ``PREFIX-NNNN`` ref for this user."""
        count = self.db.scalar(
            select(func.count()).select_from(model).where(model.user_id == self.user_id)
        ) or 0
        # Avoid collisions with seeded refs by walking forward until free.
        n = base + count + 1
        existing = {
            r for (r,) in self.db.execute(
                select(model.ref).where(model.user_id == self.user_id)
            )
        }
        while f"{prefix}-{n}" in existing:
            n += 1
        return f"{prefix}-{n}"

    # --- reads -----------------------------------------------------------
    def search_jobs(
        self, status: Optional[str] = None, customer_name: Optional[str] = None
    ) -> list[dict[str, Any]]:
        q = select(models.Job).where(
            models.Job.user_id == self.user_id, models.Job.is_active.is_(True)
        )
        if status:
            q = q.where(models.Job.status == status)
        out = []
        for j in self.db.scalars(q):
            cust = self._customer_name(j.customer_ref)
            if customer_name and customer_name.lower() not in cust.lower():
                continue
            out.append({
                "id": j.ref,
                "title": j.title,
                "customer": cust,
                "customer_id": j.customer_ref,
                "status": j.status,
                "priority": j.priority,
                "scheduled_date": j.scheduled_date,
                "assigned_tech": j.assigned_tech,
            })
        return out

    def get_job(self, job_id: str) -> Optional[dict[str, Any]]:
        j = self.db.scalar(
            select(models.Job).where(
                models.Job.user_id == self.user_id,
                models.Job.ref == job_id,
                models.Job.is_active.is_(True),
            )
        )
        if j is None:
            return None
        c = self.db.scalar(
            select(models.Customer).where(
                models.Customer.user_id == self.user_id,
                models.Customer.ref == j.customer_ref,
            )
        )
        customer = {
            "id": c.ref, "name": c.name, "contact": c.contact, "email": c.email,
            "phone": c.phone, "site_address": c.site_address,
        } if c else {"id": j.customer_ref}
        return {
            "id": j.ref,
            "customer_id": j.customer_ref,
            "title": j.title,
            "status": j.status,
            "priority": j.priority,
            "scheduled_date": j.scheduled_date,
            "assigned_tech": j.assigned_tech,
            "description": j.description,
            "notes": j.notes,
            "customer": customer,
        }

    def list_invoices(self, only_overdue: bool = False) -> list[dict[str, Any]]:
        out = []
        for inv in self.db.scalars(
            select(models.Invoice).where(
                models.Invoice.user_id == self.user_id, models.Invoice.is_active.is_(True)
            )
        ):
            overdue = self._is_overdue(inv)
            if only_overdue and not overdue:
                continue
            days_overdue = (
                (self._today - date.fromisoformat(inv.due_date)).days
                if overdue and inv.due_date else 0
            )
            out.append({
                "id": inv.ref,
                "customer": self._customer_name(inv.customer_ref),
                "customer_id": inv.customer_ref,
                "job_id": inv.job_ref,
                "amount": inv.amount,
                "issued_date": inv.issued_date,
                "due_date": inv.due_date,
                "status": inv.status,
                "overdue": overdue,
                "days_overdue": days_overdue,
            })
        return out

    def list_quotes(self) -> list[dict[str, Any]]:
        out = []
        for q in self.db.scalars(
            select(models.Quote)
            .where(models.Quote.user_id == self.user_id, models.Quote.is_active.is_(True))
            .order_by(models.Quote.id)
        ):
            out.append(self._quote_dict(q))
        return out

    def list_messages(self) -> list[dict[str, Any]]:
        out = []
        for m in self.db.scalars(
            select(models.Message)
            .where(models.Message.user_id == self.user_id, models.Message.is_active.is_(True))
            .order_by(models.Message.id)
        ):
            out.append({
                "id": m.ref, "reference_id": m.reference_id, "purpose": m.purpose,
                "body": m.body, "status": m.status,
            })
        return out

    def get_job_customer_exists(self, customer_ref: str) -> bool:
        return self.db.scalar(
            select(models.Customer.id).where(
                models.Customer.user_id == self.user_id,
                models.Customer.ref == customer_ref,
                models.Customer.is_active.is_(True),
            )
        ) is not None

    def list_customers(self) -> list[dict[str, Any]]:
        return [{
            "id": c.ref, "name": c.name, "contact": c.contact, "email": c.email,
            "phone": c.phone, "site_address": c.site_address,
        } for c in self._customers()]

    def metrics(self) -> dict[str, Any]:
        """Aggregate dashboard analytics for this account.

        Computed entirely from the existing read methods so the figures always
        match what the rest of the app shows (overdue logic, GST, etc.). The
        time series is driven off invoice ``issued_date`` (the real business
        timeline) rather than row ``created_at``.
        """
        invoices = self.list_invoices()
        jobs = self.search_jobs()
        customers = self.list_customers()
        quotes = self.list_quotes()

        paid = [i for i in invoices if i["status"] == "paid"]
        unpaid = [i for i in invoices if i["status"] != "paid"]
        overdue = [i for i in invoices if i["overdue"]]

        revenue_collected = round(sum(i["amount"] for i in paid), 2)
        outstanding = round(sum(i["amount"] for i in unpaid), 2)
        overdue_amount = round(sum(i["amount"] for i in overdue), 2)
        billed_total = round(revenue_collected + outstanding, 2)
        collection_rate = round(revenue_collected / billed_total, 4) if billed_total else 0.0
        avg_invoice = round(billed_total / len(invoices), 2) if invoices else 0.0

        # Retention: how many customers have more than one invoice on record.
        per_customer = Counter(i["customer"] for i in invoices)
        repeat_customers = sum(1 for n in per_customer.values() if n > 1)
        repeat_rate = round(repeat_customers / len(per_customer), 4) if per_customer else 0.0

        # A customer is "active" if they have open work or money outstanding.
        active_job_customers = {j["customer"] for j in jobs if j["status"] not in ("completed",)}
        active_invoice_customers = {i["customer"] for i in unpaid}
        active_customers = len(active_job_customers | active_invoice_customers)

        jobs_by_status: dict[str, int] = dict(Counter(j["status"] for j in jobs))
        active_jobs = sum(jobs_by_status.get(s, 0) for s in ("scheduled", "in_progress"))
        high_priority_jobs = sum(1 for j in jobs if j["priority"] == "high")

        draft_quotes = [q for q in quotes if q["status"] == "draft"]
        quote_pipeline = round(sum(q["total"] for q in draft_quotes), 2)

        top_overdue = [
            {
                "id": i["id"],
                "customer": i["customer"],
                "amount": i["amount"],
                "days_overdue": i["days_overdue"],
            }
            for i in sorted(overdue, key=lambda x: x["amount"], reverse=True)[:5]
        ]

        # Revenue by month for the trailing 6 months (incl. the current one).
        months: list[str] = []
        y, m = self._today.year, self._today.month
        for _ in range(6):
            months.append(f"{y:04d}-{m:02d}")
            m -= 1
            if m == 0:
                m, y = 12, y - 1
        months.reverse()
        collected_by_month: dict[str, float] = defaultdict(float)
        billed_by_month: dict[str, float] = defaultdict(float)
        for inv in invoices:
            if not inv["issued_date"]:
                continue
            key = inv["issued_date"][:7]
            billed_by_month[key] += inv["amount"]
            if inv["status"] == "paid":
                collected_by_month[key] += inv["amount"]
        revenue_by_month = [
            {
                "month": mk,
                "label": _MONTH_LABELS[int(mk[5:7]) - 1],
                "collected": round(collected_by_month.get(mk, 0.0), 2),
                "billed": round(billed_by_month.get(mk, 0.0), 2),
            }
            for mk in months
        ]

        return {
            "revenue_collected": revenue_collected,
            "outstanding": outstanding,
            "overdue_amount": overdue_amount,
            "overdue_count": len(overdue),
            "billed_total": billed_total,
            "collection_rate": collection_rate,
            "avg_invoice": avg_invoice,
            "invoices_total": len(invoices),
            "invoices_paid": len(paid),
            "invoices_unpaid": len(unpaid),
            "customers_total": len(customers),
            "active_customers": active_customers,
            "repeat_customers": repeat_customers,
            "repeat_rate": repeat_rate,
            "jobs_total": len(jobs),
            "active_jobs": active_jobs,
            "high_priority_jobs": high_priority_jobs,
            "jobs_by_status": jobs_by_status,
            "quotes_count": len(quotes),
            "quote_pipeline": quote_pipeline,
            "top_overdue": top_overdue,
            "revenue_by_month": revenue_by_month,
        }

    @staticmethod
    def _quote_totals(line_items: list[dict[str, Any]], labour_hours: float) -> dict[str, float]:
        """Compute materials/labour/GST/total from line items + labour hours."""
        materials_total = round(sum(li["qty"] * li["unit_price"] for li in line_items), 2)
        labour_total = round(labour_hours * LABOUR_RATE_PER_HOUR, 2)
        subtotal = round(materials_total + labour_total, 2)
        gst = round(subtotal * GST_RATE, 2)
        total = round(subtotal + gst, 2)
        return {
            "materials_total": materials_total,
            "labour_total": labour_total,
            "subtotal": subtotal,
            "gst": gst,
            "total": total,
        }

    @staticmethod
    def _quote_dict(q: models.Quote) -> dict[str, Any]:
        return {
            "id": q.ref, "job_id": q.job_ref, "customer": q.customer,
            "line_items": q.line_items, "labour_hours": q.labour_hours,
            "labour_rate": q.labour_rate, "materials_total": q.materials_total,
            "labour_total": q.labour_total, "subtotal": q.subtotal, "gst": q.gst,
            "total": q.total, "notes": q.notes, "status": q.status,
        }

    # --- writes (agent + user) ------------------------------------------
    def create_quote(
        self, job_id: str, line_items: list[dict[str, Any]], labour_hours: float, notes: str = ""
    ) -> dict[str, Any]:
        job = self.get_job(job_id)
        if not job:
            raise ValueError(f"No job found with id {job_id}")

        totals = self._quote_totals(line_items, labour_hours)

        quote = models.Quote(
            user_id=self.user_id,
            ref=self._next_ref(models.Quote, "QUO", 7000),
            job_ref=job_id,
            customer=job["customer"].get("name", job["customer_id"]),
            line_items=line_items,
            labour_hours=labour_hours,
            labour_rate=LABOUR_RATE_PER_HOUR,
            notes=notes,
            status="draft",
            **totals,
        )
        self.db.add(quote)
        self.db.commit()
        self.db.refresh(quote)
        return self._quote_dict(quote)

    def draft_customer_message(
        self, reference_id: str, purpose: str, body: str
    ) -> dict[str, Any]:
        msg = models.Message(
            user_id=self.user_id,
            ref=self._next_ref(models.Message, "MSG", 4000),
            reference_id=reference_id,
            purpose=purpose,
            body=body,
            status="draft",
        )
        self.db.add(msg)
        self.db.commit()
        self.db.refresh(msg)
        return {
            "id": msg.ref, "reference_id": msg.reference_id, "purpose": msg.purpose,
            "body": msg.body, "status": msg.status,
        }

    def create_customer(self, **fields: Any) -> dict[str, Any]:
        c = models.Customer(
            user_id=self.user_id,
            ref=self._next_ref(models.Customer, "CUST", 1000),
            **fields,
        )
        self.db.add(c)
        self.db.commit()
        self.db.refresh(c)
        return {
            "id": c.ref, "name": c.name, "contact": c.contact, "email": c.email,
            "phone": c.phone, "site_address": c.site_address,
        }

    def create_job(self, **fields: Any) -> dict[str, Any]:
        j = models.Job(
            user_id=self.user_id,
            ref=self._next_ref(models.Job, "JOB", 5000),
            **fields,
        )
        self.db.add(j)
        self.db.commit()
        self.db.refresh(j)
        return self.get_job(j.ref)

    def create_invoice(self, **fields: Any) -> dict[str, Any]:
        inv = models.Invoice(
            user_id=self.user_id,
            ref=self._next_ref(models.Invoice, "INV", 9000),
            **fields,
        )
        self.db.add(inv)
        self.db.commit()
        self.db.refresh(inv)
        return {
            "id": inv.ref, "customer_id": inv.customer_ref, "job_id": inv.job_ref,
            "amount": inv.amount, "issued_date": inv.issued_date,
            "due_date": inv.due_date, "status": inv.status,
        }

    # --- updates (user edits) -------------------------------------------
    def _get_row(self, model, ref: str):
        """Fetch a single *active* row by ref for this user (None if missing)."""
        return self.db.scalar(
            select(model).where(
                model.user_id == self.user_id,
                model.ref == ref,
                model.is_active.is_(True),
            )
        )

    def update_customer(self, ref: str, **fields: Any) -> dict[str, Any]:
        c = self._get_row(models.Customer, ref)
        if c is None:
            raise ValueError(f"No customer {ref}")
        for k, v in fields.items():
            setattr(c, k, v)
        self.db.commit()
        self.db.refresh(c)
        return {
            "id": c.ref, "name": c.name, "contact": c.contact, "email": c.email,
            "phone": c.phone, "site_address": c.site_address,
        }

    def update_job(self, ref: str, **fields: Any) -> dict[str, Any]:
        j = self._get_row(models.Job, ref)
        if j is None:
            raise ValueError(f"No job {ref}")
        if "customer_ref" in fields and not self.get_job_customer_exists(fields["customer_ref"]):
            raise ValueError(f"Unknown customer {fields['customer_ref']}")
        for k, v in fields.items():
            setattr(j, k, v)
        self.db.commit()
        self.db.refresh(j)
        return self.get_job(j.ref)

    def update_invoice(self, ref: str, **fields: Any) -> dict[str, Any]:
        inv = self._get_row(models.Invoice, ref)
        if inv is None:
            raise ValueError(f"No invoice {ref}")
        if "customer_ref" in fields and not self.get_job_customer_exists(fields["customer_ref"]):
            raise ValueError(f"Unknown customer {fields['customer_ref']}")
        for k, v in fields.items():
            setattr(inv, k, v)
        self.db.commit()
        # Return the full read shape (with overdue) for a consistent UI refresh.
        for row in self.list_invoices():
            if row["id"] == ref:
                return row
        return {"id": ref}

    def update_message(self, ref: str, **fields: Any) -> dict[str, Any]:
        m = self._get_row(models.Message, ref)
        if m is None:
            raise ValueError(f"No message {ref}")
        for k, v in fields.items():
            setattr(m, k, v)
        self.db.commit()
        self.db.refresh(m)
        return {
            "id": m.ref, "reference_id": m.reference_id, "purpose": m.purpose,
            "body": m.body, "status": m.status,
        }

    def update_quote(self, ref: str, **fields: Any) -> dict[str, Any]:
        q = self._get_row(models.Quote, ref)
        if q is None:
            raise ValueError(f"No quote {ref}")
        for k, v in fields.items():
            setattr(q, k, v)
        # Recompute money whenever line items or labour change.
        if "line_items" in fields or "labour_hours" in fields:
            totals = self._quote_totals(q.line_items, q.labour_hours)
            for k, v in totals.items():
                setattr(q, k, v)
            q.labour_rate = LABOUR_RATE_PER_HOUR
        self.db.commit()
        self.db.refresh(q)
        return self._quote_dict(q)

    # --- soft deletes ----------------------------------------------------
    _DELETE_MODELS = {
        "customer": models.Customer,
        "job": models.Job,
        "invoice": models.Invoice,
        "quote": models.Quote,
        "message": models.Message,
    }

    def soft_delete(self, entity: str, ref: str) -> dict[str, Any]:
        """Mark a row inactive so it disappears from reads but is never erased."""
        model = self._DELETE_MODELS.get(entity)
        if model is None:
            raise ValueError(f"Unknown entity {entity}")
        row = self._get_row(model, ref)
        if row is None:
            raise ValueError(f"No {entity} {ref}")
        row.is_active = False
        self.db.commit()
        return {"deleted": ref, "entity": entity}
