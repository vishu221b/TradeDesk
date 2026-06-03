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
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models

LABOUR_RATE_PER_HOUR = 95.00  # standard charge-out rate, ex GST
GST_RATE = 0.10               # Australian GST


class OpsClient:
    def __init__(self, db: Session, user_id: int, today: Optional[date] = None):
        self.db = db
        self.user_id = user_id
        self._today = today or date.today()

    # --- internal helpers ------------------------------------------------
    def _customers(self) -> list[models.Customer]:
        return list(
            self.db.scalars(
                select(models.Customer).where(models.Customer.user_id == self.user_id)
            )
        )

    def _customer_name(self, customer_ref: str) -> str:
        c = self.db.scalar(
            select(models.Customer).where(
                models.Customer.user_id == self.user_id,
                models.Customer.ref == customer_ref,
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
        q = select(models.Job).where(models.Job.user_id == self.user_id)
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
                "status": j.status,
                "priority": j.priority,
                "scheduled_date": j.scheduled_date,
                "assigned_tech": j.assigned_tech,
            })
        return out

    def get_job(self, job_id: str) -> Optional[dict[str, Any]]:
        j = self.db.scalar(
            select(models.Job).where(
                models.Job.user_id == self.user_id, models.Job.ref == job_id
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
            select(models.Invoice).where(models.Invoice.user_id == self.user_id)
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
            select(models.Quote).where(models.Quote.user_id == self.user_id).order_by(models.Quote.id)
        ):
            out.append(self._quote_dict(q))
        return out

    def list_messages(self) -> list[dict[str, Any]]:
        out = []
        for m in self.db.scalars(
            select(models.Message).where(models.Message.user_id == self.user_id).order_by(models.Message.id)
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
            )
        ) is not None

    def list_customers(self) -> list[dict[str, Any]]:
        return [{
            "id": c.ref, "name": c.name, "contact": c.contact, "email": c.email,
            "phone": c.phone, "site_address": c.site_address,
        } for c in self._customers()]

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

        materials_total = round(sum(li["qty"] * li["unit_price"] for li in line_items), 2)
        labour_total = round(labour_hours * LABOUR_RATE_PER_HOUR, 2)
        subtotal = round(materials_total + labour_total, 2)
        gst = round(subtotal * GST_RATE, 2)
        total = round(subtotal + gst, 2)

        quote = models.Quote(
            user_id=self.user_id,
            ref=self._next_ref(models.Quote, "QUO", 7000),
            job_ref=job_id,
            customer=job["customer"].get("name", job["customer_id"]),
            line_items=line_items,
            labour_hours=labour_hours,
            labour_rate=LABOUR_RATE_PER_HOUR,
            materials_total=materials_total,
            labour_total=labour_total,
            subtotal=subtotal,
            gst=gst,
            total=total,
            notes=notes,
            status="draft",
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
