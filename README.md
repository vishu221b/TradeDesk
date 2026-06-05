<div align="center">

# ⚡ TradeDesk

### A production, multi-user AI agent for trade & field-service operations

Ask in plain English. The agent reads your jobs, invoices, quotes and customers,
calls the right tools, and drafts the work — quotes, reminders, summaries — for a
human to approve.

[![CI](https://github.com/vishu221b/TradeDesk/actions/workflows/ci.yml/badge.svg)](https://github.com/vishu221b/TradeDesk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Node 20+](https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

> *"Which invoices are overdue, and draft a reminder for the worst one."*
> *"Draft a quote for the Wilson garage job — ~16 hours labour and standard parts."*
> *"What's scheduled this week, and is anything high priority?"*

TradeDesk is a **real agent, not a scripted chatbot**: the model decides which
operational tools to call, reads the results, and chains them (*list overdue
invoices → draft a reminder for each*). The tool-use loop is hand-written so every
external action can be traced, logged, and gated for human review before it fires.
It runs unchanged on **Claude, GPT, Gemini, local Ollama**, or a built-in keyless
**`mock`** provider — so the whole stack runs, tests and deploys with **zero API keys**.

---

## ✨ Highlights

| | |
|---|---|
| 🤖 **Provider-agnostic agent** | One hand-written tool-use loop across Claude / GPT / Gemini / Ollama / keyless `mock`. |
| 🔐 **Multi-user & persistent** | bcrypt + JWT auth; every job, invoice, quote, message, conversation and summary is scoped to the account and stored in the DB. |
| 🗂️ **Full data management** | Click-to-edit every record, add your own, **soft-delete** (never erased), and **export invoices & quotes to PDF**. |
| 🔎 **Filter everything** | Per-table filters — search + status / priority / payment / purpose / customer. |
| 📊 **Live dashboard** | Recharts analytics (revenue area, invoice donut, jobs bar), recent-activity feeds, animated KPIs — every card is clickable. |
| 🧠 **AI summaries that persist** | Summarize any record/metric with your chosen model; **save, revisit, regenerate, export to PDF, or spin a summary into a new chat**. |
| 💬 **Traceable chat** | Agent/Chat modes, persisted history, and a toggleable side panel that lists every tool call with a jump-to-message pointer. |
| 🎨 **Modern UI** | React + Vite + Tailwind SPA, URL-routed, dark/light, Monday.com-style multi-color theme with framer-motion polish. |

## 🏗️ Architecture

```
┌─────────────────────┐   HTTPS / REST   ┌──────────────────────────┐
│  React + Vite + TS   │ ───────────────► │   FastAPI  (tradedesk)   │
│  Tailwind SPA (nginx)│   /api/*  (JWT)  │  auth · chat · ops CRUD  │
│  routed · dark/light │ ◄─────────────── │  summaries · analytics   │
└─────────────────────┘                  │                          │
                                          │   TradeDeskAgent (loop)  │
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
                                          │  summaries                │
                                          └───────────────────────────┘
```

**One agent loop, many models, one swappable integration boundary.** The loop
(`agent.py`) talks to an `LLMProvider`; each provider translates a neutral tool
schema into its own wire format. The agent reaches the outside world only through
`OpsClient` — swap that one class for a real field-service API (same method names)
and nothing above it changes.

## 🚀 Quick start (local, no keys needed)

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

## 🐳 Run with Docker (full stack)

```bash
cp .env.example .env       # optional: add provider keys + set prod secrets
docker compose up --build  # UI → http://localhost:8080
```

`docker compose` builds the FastAPI backend and an nginx-served production build of
the React app (nginx proxies `/api` to the backend, with a SPA fallback for client
routes). The SQLite database lives on a named volume so data survives restarts.

## ✅ Tests & CI

[![CI](https://github.com/vishu221b/TradeDesk/actions/workflows/ci.yml/badge.svg)](https://github.com/vishu221b/TradeDesk/actions/workflows/ci.yml)

```bash
# Backend  (pytest — temp SQLite DB + keyless mock provider)
pytest                                     # auth · ops · chat · summaries · providers · tools · seed

# Frontend (Vitest + React Testing Library, then a type-checked build)
cd frontend && npm test && npm run build
```

Both suites run on every push and pull request via [GitHub Actions](./.github/workflows/ci.yml).
No API keys are needed for either suite.

## ☁️ Deploying to production

The stack is two stateless web services plus a database. Any container host works
(Fly.io, Render, Railway, ECS, Cloud Run, a VM with compose…). Checklist:

1. **Set secrets** (compose reads these from `.env`):
   - `TRADEDESK_SECRET_KEY` — JWT signing (≥32 bytes). `openssl rand -hex 32`
   - `TRADEDESK_FERNET_KEY` — encrypts per-user provider keys at rest.
     `python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"`
2. **Use a real database.** Set `TRADEDESK_DATABASE_URL` to Postgres, e.g.
   `postgresql+psycopg://user:pass@host:5432/tradedesk` (add `psycopg[binary]` to
   `requirements.txt`). Tables are created automatically on startup; for schema
   evolution add Alembic. With Postgres you can run multiple backend replicas safely.
3. **Provider keys.** Set any of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` /
   `GEMINI_API_KEY` server-side as the default for everyone, and/or let users add
   their own in Settings (stored encrypted). The `mock` provider always works.
4. **Front the app with TLS** and point the frontend at the API. Same-origin nginx
   serves `/api/*`; for a separate API origin build with `VITE_API_BASE=https://api.example.com`.
5. **Persist the database** (a volume for SQLite, or managed Postgres) and back it up.

CORS is open by default for convenience; restrict `allow_origins` in
`tradedesk/api.py` to your frontend origin in production.

## 🧭 API surface

Interactive docs at `/docs`.

| Method & path | Purpose |
|---|---|
| `POST /auth/register`, `/auth/login`, `GET /auth/me` | accounts + JWT |
| `POST /auth/provider-key` | store/clear a per-user provider key (encrypted) |
| `GET /providers` | which LLM backends are usable (and from where) |
| `POST /chat` | one agent turn — `mode: agent\|chat`; returns reply + tool calls; persisted |
| `GET/DELETE /conversations`, `GET /conversations/{id}` | chat history |
| `GET /ops/{jobs,invoices,quotes,messages,customers}` | read your data |
| `POST /ops/{customers,jobs,invoices,quotes}` | insert your own data |
| `PUT /ops/{entity}/{ref}` · `DELETE /ops/{entity}/{ref}` | edit · soft-delete a record |
| `GET /ops/metrics` | aggregated dashboard analytics |
| `POST /ops/load-sample-data` | seed your account with the sample dataset |
| `POST /summarize` | one-shot AI summary (not persisted) |
| `POST/GET /summaries`, `GET /summaries/{id}` | generate + save · list · read a summary |
| `POST /summaries/{id}/regenerate` · `DELETE /summaries/{id}` | re-run · soft-delete |

## 🛠️ The agent's tools

| Tool | What it does |
|---|---|
| `list_customers` | list customers + ids/contact |
| `search_jobs` | list/filter jobs by status or customer |
| `get_job` | full detail for one job (incl. site address) |
| `list_invoices` | list invoices; `only_overdue` for chasing payments |
| `create_quote` | draft an itemised quote (auto labour + 10% GST) |
| `draft_customer_message` | draft a reminder / scheduling / follow-up note |

Everything the agent *creates* (quotes, messages) is saved as a **draft for a human
to approve** — it informs and drafts; a person sends. Money is AUD, ex-GST; GST (10%)
is computed server-side, never by the model.

## 📁 Project layout

```
tradedesk-agent/
├── tradedesk/                 # FastAPI backend + the agent
│   ├── api.py                 # app wiring: auth, chat, conversations, summaries, providers
│   ├── ops_api.py             # operational data: read + write + edit + soft-delete + sample
│   ├── agent.py               # the provider-agnostic tool-use loop (agent & chat modes)
│   ├── tools.py               # neutral tool schemas + dispatch
│   ├── ops_client.py          # the integration boundary — user-scoped, over SQLAlchemy
│   ├── models.py / db.py      # ORM models + engine/session + schema bootstrap
│   ├── seed.py                # rich sample dataset (dates relative to "today")
│   └── providers/             # anthropic · openai(+gemini+ollama) · mock · factory
├── tests/                     # backend pytest suite
├── frontend/                  # React + Vite + TS + Tailwind SPA
│   └── src/{api,context,components,lib,pages,test}
├── .github/workflows/ci.yml   # backend + frontend CI
├── Dockerfile · frontend/Dockerfile · frontend/nginx.conf
└── docker-compose.yml         # full stack
```

## 🧩 Design notes

- **Provider-agnostic by interface.** Claude uses its native Messages API (with
  prompt caching on the system + tools prefix); OpenAI, Gemini and Ollama share one
  OpenAI-compatible class; `mock` is a keyless offline stand-in that still drives the
  real tool loop.
- **Manual tool-use loop, on purpose** — so every external action is traceable and
  gateable, which is what you want the moment this touches a real business.
- **Everything is user-scoped and soft-deleted.** Reads/updates always filter
  `user_id` and `is_active`; deletes archive rather than erase.
- **Chat history is portable across providers.** Persisted transcripts are replayed
  as plain turns when a conversation continues, so you can switch models mid-thread.

## 🤝 Contributing

Issues and PRs are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Keep CI green
(`pytest` + `npm test && npm run build`) and the keyless `mock` provider working.

## 📄 License

[MIT](./LICENSE) © Vishal Dogra
