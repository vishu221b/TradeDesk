"""Operations API: read + write the logged-in user's business data.

Everything here is account-scoped through ``OpsClient`` (built from the current
user). These routes drive the dashboard *and* let users insert their own data —
the agent then operates on exactly the same store.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import current_user
from .db import get_session
from .ops_client import OpsClient
from .seed import seed_user_data

router = APIRouter(prefix="/ops", tags=["operations"])


def get_ops(
    user: models.User = Depends(current_user),
    db: Session = Depends(get_session),
) -> OpsClient:
    return OpsClient(db, user_id=user.id, today=date.today())


# --- reads ---------------------------------------------------------------
@router.get("/jobs")
def list_jobs(
    status: Optional[str] = None, customer: Optional[str] = None,
    ops: OpsClient = Depends(get_ops),
) -> list[dict]:
    return ops.search_jobs(status=status, customer_name=customer)


@router.get("/jobs/{job_ref}")
def get_job(job_ref: str, ops: OpsClient = Depends(get_ops)) -> dict:
    job = ops.get_job(job_ref)
    if job is None:
        raise HTTPException(status_code=404, detail=f"No job {job_ref}")
    return job


@router.get("/invoices")
def list_invoices(only_overdue: bool = False, ops: OpsClient = Depends(get_ops)) -> list[dict]:
    return ops.list_invoices(only_overdue=only_overdue)


@router.get("/quotes")
def list_quotes(ops: OpsClient = Depends(get_ops)) -> list[dict]:
    return ops.list_quotes()


@router.get("/messages")
def list_messages(ops: OpsClient = Depends(get_ops)) -> list[dict]:
    return ops.list_messages()


@router.get("/customers")
def list_customers(ops: OpsClient = Depends(get_ops)) -> list[dict]:
    return ops.list_customers()


@router.get("/metrics")
def get_metrics(ops: OpsClient = Depends(get_ops)) -> dict:
    """Aggregated analytics for the dashboard (revenue, overdue, retention…)."""
    return ops.metrics()


# --- writes (user-entered data) -----------------------------------------
@router.post("/customers", status_code=201)
def create_customer(body: schemas.CustomerCreate, ops: OpsClient = Depends(get_ops)) -> dict:
    return ops.create_customer(**body.model_dump())


@router.post("/jobs", status_code=201)
def create_job(body: schemas.JobCreate, ops: OpsClient = Depends(get_ops)) -> dict:
    if ops.get_job_customer_exists(body.customer_ref) is False:
        raise HTTPException(status_code=400, detail=f"Unknown customer {body.customer_ref}")
    return ops.create_job(**body.model_dump())


@router.post("/invoices", status_code=201)
def create_invoice(body: schemas.InvoiceCreate, ops: OpsClient = Depends(get_ops)) -> dict:
    return ops.create_invoice(**body.model_dump())


@router.post("/quotes", status_code=201)
def create_quote(body: schemas.QuoteCreate, ops: OpsClient = Depends(get_ops)) -> dict:
    try:
        return ops.create_quote(
            job_id=body.job_ref,
            line_items=[li.model_dump() for li in body.line_items],
            labour_hours=body.labour_hours,
            notes=body.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# --- updates (edit existing rows) ---------------------------------------
@router.put("/customers/{ref}")
def update_customer(ref: str, body: schemas.CustomerUpdate, ops: OpsClient = Depends(get_ops)) -> dict:
    try:
        return ops.update_customer(ref, **body.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/jobs/{ref}")
def update_job(ref: str, body: schemas.JobUpdate, ops: OpsClient = Depends(get_ops)) -> dict:
    try:
        return ops.update_job(ref, **body.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/invoices/{ref}")
def update_invoice(ref: str, body: schemas.InvoiceUpdate, ops: OpsClient = Depends(get_ops)) -> dict:
    try:
        return ops.update_invoice(ref, **body.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/quotes/{ref}")
def update_quote(ref: str, body: schemas.QuoteUpdate, ops: OpsClient = Depends(get_ops)) -> dict:
    fields = body.model_dump(exclude_unset=True)
    if "line_items" in fields:
        fields["line_items"] = [
            li if isinstance(li, dict) else li.model_dump() for li in (body.line_items or [])
        ]
    try:
        return ops.update_quote(ref, **fields)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/messages/{ref}")
def update_message(ref: str, body: schemas.MessageUpdate, ops: OpsClient = Depends(get_ops)) -> dict:
    try:
        return ops.update_message(ref, **body.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# --- soft deletes -------------------------------------------------------
@router.delete("/{entity}/{ref}")
def delete_entity(entity: str, ref: str, ops: OpsClient = Depends(get_ops)) -> dict:
    """Soft-delete a row (sets ``is_active=False``); it vanishes from all reads."""
    if entity not in ("customers", "jobs", "invoices", "quotes", "messages"):
        raise HTTPException(status_code=404, detail=f"Unknown entity {entity}")
    singular = entity[:-1]  # customers -> customer
    try:
        return ops.soft_delete(singular, ref)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# --- sample data ---------------------------------------------------------
@router.post("/load-sample-data")
def load_sample(
    replace: bool = False,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_session),
) -> dict:
    """Populate this account with the rich sample dataset (no-op if data exists)."""
    wrote = seed_user_data(db, user.id, today=date.today(), replace=replace)
    return {"loaded": wrote, "replace": replace}
