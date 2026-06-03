"""Sample dataset builder.

Produces a rich, per-user set of customers / jobs / invoices / quotes / messages
covering the common situations a trade business hits: scheduled and in-progress
work, quote requests, completed-and-invoiced jobs, paid invoices, and overdue
invoices of varying ages. All dates are generated *relative to a reference date*
so "overdue by N days" stays realistic whenever the app is run.

The same builder backs two things: the pre-seeded ``demo`` account created on
startup, and the per-account "Load sample data" button (accounts otherwise start
empty). Seeding a user that already has data is a no-op unless ``replace=True``.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .security import hash_password

DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo1234"


def _iso(today: date, offset_days: int) -> str:
    return (today + timedelta(days=offset_days)).isoformat()


def _sample(today: date) -> dict:
    """The full sample dataset, with dates relative to ``today``."""
    customers = [
        dict(ref="CUST-1001", name="Henderson Builders Pty Ltd", contact="Marcus Henderson",
             email="accounts@hendersonbuilders.com.au", phone="07 3123 4567",
             site_address="14 Kingsford Smith Dr, Hamilton QLD 4007"),
        dict(ref="CUST-1002", name="Brookside Cafe", contact="Lena Brooks",
             email="lena@brooksidecafe.com.au", phone="0412 884 220",
             site_address="3/88 Racecourse Rd, Ascot QLD 4007"),
        dict(ref="CUST-1003", name="Stafford Family Medical", contact="Dr. Priya Nair",
             email="admin@staffordmedical.com.au", phone="07 3555 9090",
             site_address="210 Stafford Rd, Stafford QLD 4053"),
        dict(ref="CUST-1004", name="Northgate Warehousing", contact="Sam O'Donnell",
             email="sam@northgatewh.com.au", phone="0438 110 552",
             site_address="5 Toombul Rd, Northgate QLD 4013"),
        dict(ref="CUST-1005", name="Wilson Residence", contact="Janet Wilson",
             email="janet.wilson82@gmail.com", phone="0401 776 213",
             site_address="9 Lamington Ave, Ascot QLD 4007"),
        dict(ref="CUST-1006", name="Riverside Apartments (Body Corp)", contact="Tony Vella",
             email="manager@riversidebc.com.au", phone="07 3210 8800",
             site_address="120 Kingsford Smith Dr, Hamilton QLD 4007"),
        dict(ref="CUST-1007", name="Greenfield Primary School", contact="Karen Liu",
             email="facilities@greenfieldps.qld.edu.au", phone="07 3344 1212",
             site_address="40 Learning St, Carindale QLD 4152"),
        dict(ref="CUST-1008", name="Patel Constructions", contact="Anil Patel",
             email="anil@patelconstructions.com.au", phone="0455 901 334",
             site_address="22 Industrial Ave, Wacol QLD 4076"),
        dict(ref="CUST-1009", name="The Corner Bakehouse", contact="Maria Costa",
             email="hello@cornerbakehouse.com.au", phone="0423 556 778",
             site_address="61 Oxford St, Bulimba QLD 4171"),
        dict(ref="CUST-1010", name="Eastside Gym", contact="Jordan Mills",
             email="ops@eastsidegym.com.au", phone="07 3899 2020",
             site_address="8 Fitness Way, Cannon Hill QLD 4170"),
    ]

    jobs = [
        dict(ref="JOB-5012", customer_ref="CUST-1001",
             title="Switchboard upgrade - new apartment block", status="in_progress",
             priority="high", scheduled_date=_iso(today, 1), assigned_tech="Dave R.",
             description="Upgrade main switchboard to 3-phase and install 6 new sub-circuits for level 2 fit-out.",
             notes="Builder needs sign-off before plasterers start Mon."),
        dict(ref="JOB-5013", customer_ref="CUST-1002",
             title="Replace failed exhaust hood wiring", status="scheduled",
             priority="high", scheduled_date=_iso(today, 0), assigned_tech="Priya K.",
             description="Commercial kitchen exhaust hood tripping RCD. Diagnose and re-wire.",
             notes="Cafe wants it done before weekend trade."),
        dict(ref="JOB-5014", customer_ref="CUST-1003",
             title="Emergency + exit light compliance test", status="scheduled",
             priority="medium", scheduled_date=_iso(today, 4), assigned_tech="Dave R.",
             description="6-monthly AS2293 emergency lighting test across the clinic.",
             notes=""),
        dict(ref="JOB-5015", customer_ref="CUST-1004",
             title="Warehouse LED high-bay changeover", status="quote_requested",
             priority="low", scheduled_date=None, assigned_tech=None,
             description="Customer wants 40 metal-halide high-bays replaced with LED. Needs a quote.",
             notes="Asked for ballpark by end of week."),
        dict(ref="JOB-5016", customer_ref="CUST-1005",
             title="New circuit to detached garage", status="quote_requested",
             priority="medium", scheduled_date=None, assigned_tech=None,
             description="Run a new sub-main from house board to detached garage, install garage board, 4 power points and 2 LED battens.",
             notes="Customer mentioned wanting an EV charger later - size for it."),
        dict(ref="JOB-5017", customer_ref="CUST-1002",
             title="Add power points - new coffee station", status="completed",
             priority="low", scheduled_date=_iso(today, -9), assigned_tech="Priya K.",
             description="Install 3 double GPOs on dedicated circuit for new espresso setup.",
             notes="Completed, invoiced."),
        dict(ref="JOB-5018", customer_ref="CUST-1006",
             title="Common-area lighting fault - basement carpark", status="in_progress",
             priority="high", scheduled_date=_iso(today, 0), assigned_tech="Tom N.",
             description="Several fluoro fittings out in basement carpark; intermittent RCD trips on common-area board.",
             notes="Body corp reports it as a safety issue - prioritise."),
        dict(ref="JOB-5019", customer_ref="CUST-1007",
             title="Classroom power upgrade - block C", status="quote_requested",
             priority="medium", scheduled_date=None, assigned_tech=None,
             description="Add 8 double GPOs and 2 dedicated circuits for new IT trolleys across 4 classrooms.",
             notes="Works must happen in the upcoming school holidays."),
        dict(ref="JOB-5020", customer_ref="CUST-1008",
             title="Temporary builders supply - new site", status="scheduled",
             priority="medium", scheduled_date=_iso(today, 6), assigned_tech="Dave R.",
             description="Install temporary builders supply pole and RCD-protected outlets for a new build site.",
             notes=""),
        dict(ref="JOB-5021", customer_ref="CUST-1009",
             title="Oven circuit keeps tripping", status="scheduled",
             priority="high", scheduled_date=_iso(today, 1), assigned_tech="Priya K.",
             description="Deck oven trips its breaker under load. Diagnose - possible cable or element fault.",
             notes="Bakery loses trade every morning it's down."),
        dict(ref="JOB-5022", customer_ref="CUST-1010",
             title="Install EV charger - staff carpark", status="quote_requested",
             priority="low", scheduled_date=None, assigned_tech=None,
             description="Supply and install a 22kW 3-phase EV charger with load management on the staff carpark wall.",
             notes="Wants to know if existing supply is adequate."),
        dict(ref="JOB-5023", customer_ref="CUST-1001",
             title="Defect rectification - level 1 GPOs", status="completed",
             priority="medium", scheduled_date=_iso(today, -16), assigned_tech="Tom N.",
             description="Rectify two GPOs flagged on the level 1 inspection report.",
             notes="Signed off."),
        dict(ref="JOB-5024", customer_ref="CUST-1003",
             title="Add RCD protection to reception circuit", status="completed",
             priority="medium", scheduled_date=_iso(today, -30), assigned_tech="Dave R.",
             description="Retrofit RCBO to the reception ring after a nuisance trip incident.",
             notes="Completed and tested."),
    ]

    invoices = [
        # Overdue, escalating ages
        dict(ref="INV-9001", customer_ref="CUST-1001", job_ref="JOB-5023", amount=8460.00,
             issued_date=_iso(today, -45), due_date=_iso(today, -31), status="unpaid"),
        dict(ref="INV-9003", customer_ref="CUST-1003", job_ref="JOB-5024", amount=540.00,
             issued_date=_iso(today, -61), due_date=_iso(today, -47), status="unpaid"),
        dict(ref="INV-9005", customer_ref="CUST-1006", job_ref=None, amount=1980.00,
             issued_date=_iso(today, -38), due_date=_iso(today, -24), status="unpaid"),
        dict(ref="INV-9006", customer_ref="CUST-1009", job_ref=None, amount=415.00,
             issued_date=_iso(today, -20), due_date=_iso(today, -6), status="unpaid"),
        # Unpaid but not yet due
        dict(ref="INV-9002", customer_ref="CUST-1002", job_ref="JOB-5017", amount=1320.50,
             issued_date=_iso(today, -9), due_date=_iso(today, 5), status="unpaid"),
        dict(ref="INV-9007", customer_ref="CUST-1007", job_ref=None, amount=3300.00,
             issued_date=_iso(today, -3), due_date=_iso(today, 11), status="unpaid"),
        # Paid
        dict(ref="INV-9004", customer_ref="CUST-1004", job_ref=None, amount=2750.00,
             issued_date=_iso(today, -28), due_date=_iso(today, -14), status="paid"),
        dict(ref="INV-9008", customer_ref="CUST-1001", job_ref="JOB-5012", amount=12100.00,
             issued_date=_iso(today, -52), due_date=_iso(today, -38), status="paid"),
    ]

    quotes = [
        dict(ref="QUO-7001", job_ref="JOB-5013", customer="Brookside Cafe",
             line_items=[
                 {"description": "High-Temperature Silicone Cable (10m)", "qty": 10, "unit_price": 13.5},
                 {"description": "Heat-Resistant TPS Cable (15m)", "qty": 15, "unit_price": 1.5},
                 {"description": "IP66 Weatherproof Junction Boxes", "qty": 2, "unit_price": 24},
                 {"description": "Ceramic Terminal Blocks (15A, 3-Pole)", "qty": 3, "unit_price": 7.2},
                 {"description": "10A/16A RCBO (Clipsal Resi MAX 1P+N)", "qty": 1, "unit_price": 32.62},
             ],
             labour_hours=26, labour_rate=95.0, materials_total=204.22,
             labour_total=2470.0, subtotal=2674.22, gst=267.42, total=2941.64,
             notes="Diagnose and re-wire commercial kitchen exhaust hood. Prices ex-GST.",
             status="draft"),
    ]

    messages = [
        dict(ref="MSG-4001", reference_id="INV-9003", purpose="payment_reminder",
             body=("Hi Dr. Nair, a friendly reminder that invoice INV-9003 for $540.00 is now "
                   "overdue. Could you let us know when we can expect payment? Happy to resend "
                   "the invoice if helpful. Thanks!"),
             status="draft"),
    ]

    return {
        "customers": customers,
        "jobs": jobs,
        "invoices": invoices,
        "quotes": quotes,
        "messages": messages,
    }


def user_has_data(db: Session, user_id: int) -> bool:
    return db.scalar(
        select(models.Customer.id).where(models.Customer.user_id == user_id).limit(1)
    ) is not None


def clear_user_data(db: Session, user_id: int) -> None:
    for model in (models.Customer, models.Job, models.Invoice, models.Quote, models.Message):
        for row in db.scalars(select(model).where(model.user_id == user_id)).all():
            db.delete(row)
    db.flush()


def seed_user_data(db: Session, user_id: int, today: date, replace: bool = False) -> bool:
    """Seed the sample dataset for one user. Returns True if data was written."""
    if user_has_data(db, user_id):
        if not replace:
            return False
        clear_user_data(db, user_id)

    data = _sample(today)
    for c in data["customers"]:
        db.add(models.Customer(user_id=user_id, **c))
    for j in data["jobs"]:
        db.add(models.Job(user_id=user_id, **j))
    for inv in data["invoices"]:
        db.add(models.Invoice(user_id=user_id, **inv))
    for q in data["quotes"]:
        db.add(models.Quote(user_id=user_id, **q))
    for m in data["messages"]:
        db.add(models.Message(user_id=user_id, **m))
    db.commit()
    return True


def ensure_demo_user(db: Session, today: date) -> models.User:
    """Create the pre-seeded demo account if it doesn't exist."""
    user = db.scalar(select(models.User).where(models.User.username == DEMO_USERNAME))
    if user is None:
        user = models.User(
            username=DEMO_USERNAME,
            email="demo@tradedesk.local",
            password_hash=hash_password(DEMO_PASSWORD),
            encrypted_keys={},
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    seed_user_data(db, user.id, today)
    return user
