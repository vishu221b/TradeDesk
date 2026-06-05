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


def test_metrics_empty_account(client, user):
    m = client.get("/ops/metrics", headers=user["headers"]).json()
    assert m["invoices_total"] == 0
    assert m["revenue_collected"] == 0
    assert m["collection_rate"] == 0.0
    assert len(m["revenue_by_month"]) == 6


def test_metrics_seeded_account(seeded_user, client):
    m = client.get("/ops/metrics", headers=seeded_user["headers"]).json()
    assert m["invoices_total"] >= 1
    assert m["overdue_count"] >= 1
    assert m["overdue_amount"] > 0
    assert m["customers_total"] >= 10
    # collected + outstanding should reconcile to billed_total
    assert round(m["revenue_collected"] + m["outstanding"], 2) == m["billed_total"]
    assert 0.0 <= m["collection_rate"] <= 1.0
    assert len(m["top_overdue"]) >= 1


def test_create_invoice(client, user):
    h = user["headers"]
    cust = client.post("/ops/customers", headers=h, json={"name": "Inv Co"}).json()
    inv = client.post("/ops/invoices", headers=h, json={
        "customer_ref": cust["id"], "amount": 100.0, "status": "unpaid",
    })
    assert inv.status_code == 201
    assert inv.json()["id"].startswith("INV-")


def test_update_customer(client, user):
    h = user["headers"]
    cust = client.post("/ops/customers", headers=h, json={"name": "Old Name"}).json()
    r = client.put(f"/ops/customers/{cust['id']}", headers=h, json={"name": "New Name", "phone": "0400"})
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"
    assert r.json()["phone"] == "0400"
    # unknown ref -> 404
    assert client.put("/ops/customers/CUST-0000", headers=h, json={"name": "x"}).status_code == 404


def test_update_invoice_status(client, user):
    h = user["headers"]
    cust = client.post("/ops/customers", headers=h, json={"name": "Pay Co"}).json()
    inv = client.post("/ops/invoices", headers=h, json={"customer_ref": cust["id"], "amount": 50.0}).json()
    r = client.put(f"/ops/invoices/{inv['id']}", headers=h, json={"status": "paid"})
    assert r.status_code == 200
    assert r.json()["status"] == "paid"


def test_update_quote_recomputes_gst(client, user):
    h = user["headers"]
    cust = client.post("/ops/customers", headers=h, json={"name": "Quote Edit Co"}).json()
    job = client.post("/ops/jobs", headers=h, json={"customer_ref": cust["id"], "title": "J"}).json()
    q = client.post("/ops/quotes", headers=h, json={
        "job_ref": job["id"],
        "line_items": [{"description": "Cable", "qty": 10, "unit_price": 5.0}],
        "labour_hours": 2,
    }).json()
    # Edit: bump labour to 4h, materials now 100 -> labour 380, subtotal 480, gst 48, total 528
    r = client.put(f"/ops/quotes/{q['id']}", headers=h, json={
        "line_items": [{"description": "Cable", "qty": 20, "unit_price": 5.0}],
        "labour_hours": 4,
    }).json()
    assert r["materials_total"] == 100.0
    assert r["labour_total"] == 380.0
    assert r["total"] == 528.0


def test_soft_delete_hides_row(client, user):
    h = user["headers"]
    cust = client.post("/ops/customers", headers=h, json={"name": "Gone Co"}).json()
    assert len(client.get("/ops/customers", headers=h).json()) == 1
    d = client.delete(f"/ops/customers/{cust['id']}", headers=h)
    assert d.status_code == 200
    # vanishes from reads
    assert client.get("/ops/customers", headers=h).json() == []
    # second delete / update of a gone row -> 404
    assert client.delete(f"/ops/customers/{cust['id']}", headers=h).status_code == 404
    assert client.put(f"/ops/customers/{cust['id']}", headers=h, json={"name": "x"}).status_code == 404
