# --- TradeDesk backend (FastAPI + agent) ---
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY tradedesk ./tradedesk
COPY data ./data

# The SQLite DB lives under /app/data — mount a volume there to persist it.
EXPOSE 8000

# 1 worker by default: the in-process nothing is shared beyond the DB, so you
# can scale workers/replicas freely once DATABASE_URL points at Postgres.
CMD ["uvicorn", "tradedesk.api:app", "--host", "0.0.0.0", "--port", "8000"]
