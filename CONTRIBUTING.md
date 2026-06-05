# Contributing to TradeDesk

Thanks for taking the time to contribute! This project is a full-stack AI agent
(FastAPI backend + React/Vite frontend). The guidelines below keep changes easy
to review and the build green.

## Ground rules

- **Be respectful.** Assume good intent; keep discussion technical and kind.
- **One concern per PR.** Small, focused pull requests merge faster.
- **Keep it green.** Backend (`pytest`) and frontend (`npm test` + `npm run build`)
  must pass before requesting review. CI runs both on every PR.
- **No keys required.** The keyless `mock` provider must keep working; never make
  a feature depend on a real API key to run or to test.
- **Respect the invariants** documented in [`CLAUDE.md`](./CLAUDE.md): everything
  is user-scoped, deletes are soft (`is_active`), money is AUD/ex-GST with GST
  computed server-side, and nothing is ever "sent" — quotes/messages are drafts.

## Getting set up

```bash
# Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn tradedesk.api:app --reload      # http://localhost:8000  (/docs)
pytest

# Frontend
cd frontend
npm install
npm run dev                             # http://localhost:5173
npm test
npm run build                           # tsc -b + vite build (type-check)
```

Demo login: `demo` / `demo1234`.

## Making a change

1. **Fork & branch.** Branch from `main` using a descriptive name:
   `feat/…`, `fix/…`, `docs/…`, `chore/…`.
2. **Write code that reads like the surrounding code.** Match naming, comment
   density, and existing patterns. See `CLAUDE.md` for the "adding capabilities"
   recipes (new tool, new dashboard data, new provider, new DB field).
3. **Add or update tests** for behavior changes. Backend tests live in `tests/`;
   frontend tests in `frontend/src/test/`.
4. **Run the full suite locally** (`pytest` and `npm test && npm run build`).
5. **Open a PR** against `main` with a clear description of what and why. Link any
   related issue. CI must be green.

## Commit & PR style

- Use clear, imperative commit subjects (e.g. `fix: omit empty tools arg`).
- Conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
  `test:`) are appreciated but not required.
- Describe user-facing changes and any migration/ops impact in the PR body.

## Reporting bugs / requesting features

Open a GitHub issue with:

- what you expected vs. what happened (include error output / screenshots),
- steps to reproduce, and
- your environment (OS, Python/Node versions, provider used).

By contributing, you agree that your contributions are licensed under the
project's [MIT License](./LICENSE).
