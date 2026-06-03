"""Operations: sample data, per-user isolation, CRUD, overdue logic, quote math."""

from __future__ import annotations


def test_new_account_starts_empty(client, user):
    assert client.get("/ops/jobs", headers=user["headers"]).json() == []
    assert client.get("/ops/customers", headers=user["headers"]).json() == []


def test_load_sample_data(client, user):
    r = client.post("/ops/load-sample-data", headers=user["headers"])
    assert r.json()["loaded"] is True
    assert len(client.get("/ops/jobs", headers=user["headers"]).json()) >= 10
    assert len(client.get("/ops/customers", headers=user["headers"]).json()) >= 10
    # second load is a no-op (data already present)
    assert client.post("/ops/load-sample-data", headers=user["headers"]).json()["loaded"] is False


def test_user_data_isolated(client):
    from tests.conftest import _register

    a = _register(client)
    b = _register(client)
    client.post("/ops/load-sample-data", headers=a["headers"])
    assert len(client.get("/ops/jobs", headers=a["headers"]).json()) >= 10
    assert client.get("/ops/jobs", headers=b["headers"]).json() == []


def test_overdue_invoices(seeded_user, client):
    inv = client.get("/ops/invoices", headers=seeded_user["headers"], params={"only_overdue": True}).json()
    assert len(inv) >= 1
    assert all(i["overdue"] and i["days_overdue"] > 0 for i in inv)


def test_create_customer_then_job(client, user):
    h = user["headers"]
    cust = client.post("/ops/customers", headers=h, json={"name": "Acme Pty Ltd"}).json()
    assert cust["id"].startswith("CUST-")

    job = client.post("/ops/jobs", headers=h, json={
        "customer_ref": cust["id"], "title": "Test job", "status": "scheduled",
    })
    assert job.status_code == 201
    assert job.json()["customer"]["name"] == "Acme Pty Ltd"

    # job against an unknown customer is rejected
    bad = client.post("/ops/jobs", headers=h, json={"customer_ref": "CUST-9999", "title": "x"})
    assert bad.status_code == 400


def test_create_quote_computes_gst(client, user):
    h = user["headers"]
    cust = client.post("/ops/customers", headers=h, json={"name": "Quote Co"}).json()
    job = client.post("/ops/jobs", headers=h, json={"customer_ref": cust["id"], "title": "Quote job"}).json()

    q = client.post("/ops/quotes", headers=h, json={
        "job_ref": job["id"],
        "line_items": [{"description": "Cable", "qty": 10, "unit_price": 5.0}],
        "labour_hours": 2,
    }).json()
    # materials 50 + labour 2*95=190 => subtotal 240, gst 24, total 264
    assert q["materials_total"] == 50.0
    assert q["labour_total"] == 190.0
    assert q["subtotal"] == 240.0
    assert q["gst"] == 24.0
    assert q["total"] == 264.0


def test_create_invoice(client, user):
    h = user["headers"]
    cust = client.post("/ops/customers", headers=h, json={"name": "Inv Co"}).json()
    inv = client.post("/ops/invoices", headers=h, json={
        "customer_ref": cust["id"], "amount": 100.0, "status": "unpaid",
    })
    assert inv.status_code == 201
    assert inv.json()["id"].startswith("INV-")
