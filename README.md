# TradeDesk — a production AI agent for trade & field-service operations

TradeDesk is a **full-fledged, deployable AI agent** that sits on top of a trade
/ field-service business's operational system — jobs, customers, invoices,
quotes — and handles everyday office work in plain English:

- *"Which invoices are overdue, and draft a reminder for the worst one."*
- *"Draft a quote for the Wilson garage job — ~16 hours labour and standard parts."*
- *"What's scheduled this week, and is anything high priority?"*

It is a real agent, not a scripted chatbot: the model decides which operational
tools to call, reads the results, and chains them (e.g. *list overdue invoices →
draft a reminder for each*). The tool-use loop is hand-written so every external
action can be traced, logged, and gated for human review before it fires.

It is also a complete product, not a demo script:

- **Multi-user with login.** Username/password auth (bcrypt + JWT). Every job,
  invoice, quote, message and conversation is scoped to the signed-in account.
- **Database-backed.** All data lives in SQLite (auto-created and seeded on first
  run); point one env var at Postgres for production. **Chat history is
  persisted** per user and reloads across sessions.
- **Your data, your way.** Accounts start empty; load a rich sample dataset with
  one click, or insert your own customers, jobs and invoices — the agent then
  operates on exactly what you put in.
- **Runs anywhere.** Provider-agnostic across **Claude, GPT, Gemini, and local
  Ollama**, plus a built-in keyless **`mock`** provider so the whole stack runs,
  tests, and deploys with **zero API keys**.
- **Agent or chat.** Toggle between *Agent mode* (tools enabled, grounded in your
  data) and *Chat mode* (a plain conversation about anything).
- **Modern UI.** A React + Vite + Tailwind single-page app — n8n-style, dark/light
  themed, with the agent's tool calls shown inline and a live operations dashboard.

## Architecture

```
┌─────────────────────┐   HTTPS / REST   ┌──────────────────────────┐
│  React + Vite + TS   │ ───────────────► │   FastAPI  (tradedesk)   │
│  Tailwind SPA (nginx)│   /api/*  (JWT)  │  auth · chat · ops CRUD  │
│  dark/light · n8n UI │ ◄─────────────── │                          │
└─────────────────────┘                  │   TradeDeskAgent (loop)  │
                                          │     ├─ providers/*       │
                                          │     ├─ tools (neutral)   │
                                          │     └─ OpsClient ──────┐ │
                                          └────────────────────────┼─┘
                                                   SQLAlchemy       │
                                          ┌────────────────────────▼─┐
                                          │  SQLite (→ Postgres)      │
                                          │  users · jobs · invoices  │
                                          │  quotes · messages        │
                                          │  conversations · history  │
                                          └───────────────────────────┘
```

**One agent loop, many models, one swappable integration boundary.** The loop
(`agent.py`) talks to an `LLMProvider`; each provider translates a neutral tool
schema into its own wire format. The agent reaches the outside world only through
`OpsClient` — swap that one class for a real field-service API (same method
names) and nothing above it changes.

## Quick start (local, no keys needed)

```bash
# 1) Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn tradedesk.api:app --reload        # http://localhost:8000  (/docs for Swagger)

# 2) Frontend (separate terminal)
cd frontend
npm install
npm run dev                                # http://localhost:5173
```

Open <http://localhost:5173>, sign up, or use the seeded demo account
**`demo` / `demo1234`**. With no API keys configured the **`mock`** provider is
selected automatically; pick Anthropic / OpenAI / Gemini / Ollama in the header
once you add a key (server-side in `.env`, or per-account in **Settings**).

The Vite dev server proxies `/api` to the backend, so there's nothing else to
configure. Override the backend location with `VITE_PROXY_TARGET` if needed.

## Run with Docker (full stack)

```bash
cp .env.example .env       # optional: add provider keys + set prod secrets
docker compose up --build  # UI → http://localhost:8080
```

`docker compose` builds the FastAPI backend and an nginx-served production build
of the React app (nginx proxies `/api` to the backend). The SQLite database is
stored on a named volume so data survives restarts.

## Deploying to production

The stack is two stateless web services plus a database. Any container host
works (Fly.io, Render, Railway, ECS, Cloud Run, a VM with compose…). Checklist:

1. **Set secrets** (compose reads these from `.env`):
   - `TRADEDESK_SECRET_KEY` — JWT signing. `openssl rand -hex 32`
   - `TRADEDESK_FERNET_KEY` — encrypts per-user provider keys at rest.
     `python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"`
2. **Use a real database.** Set `TRADEDESK_DATABASE_URL` to Postgres, e.g.
   `postgresql+psycopg://user:pass@host:5432/tradedesk` (add `psycopg[binary]`
   to `requirements.txt`). Tables are created automatically on startup; for
   schema evolution add Alembic. With Postgres you can run multiple backend
   replicas/workers safely — nothing is shared in-process except the DB.
3. **Provider keys.** Set any of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` /
   `GEMINI_API_KEY` server-side as the default for everyone, and/or let users add
   their own in Settings (stored encrypted). The `mock` provider always works.
4. **Front the app with TLS** (your platform's load balancer or a reverse proxy)
   and point the frontend at the API. In the same-origin nginx setup the SPA
   calls `/api/*`; if you host the API on another origin, build the frontend with
   `VITE_API_BASE=https://api.example.com`.
5. **Persist the database** (a volume for SQLite, or managed Postgres) and back
   it up.

CORS is open by default for convenience; restrict `allow_origins` in
`tradedesk/api.py` to your frontend origin in production.

## Tests

```bash
# Backend  (pytest — uses a temp SQLite DB and the keyless mock provider)
pip install -r requirements.txt
pytest                                     # 29 tests: auth, ops, chat, tools, seed

# Frontend (Vitest + React Testing Library)
cd frontend && npm install && npm test     # 11 tests: auth, theme, chat, tool render
```

No API keys are needed for either suite.

## Project layout

```
tradedesk-agent/
├── tradedesk/                 # FastAPI backend + the agent
│   ├── api.py                 # app wiring: auth, chat (persisted), conversations, providers
│   ├── ops_api.py             # operational data: read + user-entered writes + load-sample
│   ├── auth.py                # register / login / me + per-user provider keys
│   ├── agent.py               # the provider-agnostic tool-use loop (agent & chat modes)
│   ├── tools.py               # neutral tool schemas + dispatch
│   ├── ops_client.py          # the integration boundary — user-scoped, over SQLAlchemy
│   ├── models.py / db.py      # ORM models + engine/session + schema bootstrap
│   ├── seed.py                # rich sample dataset (dates relative to "today")
│   ├── security.py / config.py
│   └── providers/             # anthropic · openai(+gemini+ollama) · mock · factory
├── tests/                     # backend pytest suite
├── frontend/                  # React + Vite + TS + Tailwind SPA
│   └── src/{api,context,components,pages,test}
├── Dockerfile                 # backend image
├── frontend/Dockerfile + nginx.conf
└── docker-compose.yml         # full stack
```

### API surface

| Method & path | Purpose |
|---|---|
| `POST /auth/register`, `/auth/login`, `GET /auth/me` | accounts + JWT |
| `POST /auth/provider-key` | store/clear a per-user provider key (encrypted) |
| `GET /providers` | which LLM backends are usable (and from where) |
| `POST /chat` | one agent turn — `mode: agent\|chat`; returns reply + tool calls; persisted |
| `GET/DELETE /conversations`, `GET /conversations/{id}` | chat history |
| `GET /ops/{jobs,invoices,quotes,messages,customers}` | read your data |
| `POST /ops/{customers,jobs,invoices,quotes}` | insert your own data |
| `POST /ops/load-sample-data` | seed your account with the sample dataset |

Interactive docs at `/docs`.

### The agent's tools

| Tool | What it does |
|---|---|
| `list_customers` | list customers + ids/contact |
| `search_jobs` | list/filter jobs by status or customer |
| `get_job` | full detail for one job (incl. site address) |
| `list_invoices` | list invoices; `only_overdue` for chasing payments |
| `create_quote` | draft an itemised quote (auto labour + 10% GST) |
| `draft_customer_message` | draft a reminder / scheduling / follow-up note |

Everything the agent *creates* (quotes, messages) is saved as a **draft for a
human to approve** — it informs and drafts; a person sends. Money is AUD, ex-GST;
GST (10%) is computed server-side, never by the model.

## Design notes

- **Provider-agnostic by interface.** Claude uses its native Messages API (with
  prompt caching on the system + tools prefix); OpenAI, Gemini, and Ollama share
  one OpenAI-compatible class; `mock` is a keyless offline stand-in that still
  drives the real tool loop.
- **Manual tool-use loop, on purpose** — so every external action is traceable
  and gateable, which is what you want the moment this touches a real business.
- **Chat history is portable across providers.** Persisted transcripts are
  replayed as plain turns when a conversation continues, so you can switch models
  mid-thread without corrupting history.
- **Tool descriptions state *when* to call**, not just what they do — models reach
  for tools conservatively, so the trigger condition matters.
