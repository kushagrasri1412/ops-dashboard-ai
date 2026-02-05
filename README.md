# Restaurant Digital Ops Dashboard + AI Ops Copilot

A responsive, Stripe-style operations dashboard for restaurant digital channels.

This repo is meant to signal “production-flavored AI engineering”:
- Thin client UI + server-side APIs
- Forecast + anomaly detection
- AI copilot with strict structured JSON outputs (schema enforced)
- Prompt versioning + eval harness
- SQLite logging + system health metrics

## Problem

Restaurant ops teams need to quickly understand revenue health, store/channel performance, and what to do next when anomalies happen (promo issues, channel outages, menu sync drift, staffing constraints).

## Success Metrics

User-facing
- Time-to-insight: seconds to identify anomaly cause
- Task completion rate: e.g., “find top 3 risk days/stores”
- Copilot helpfulness rating

AI / technical
- JSON schema compliance rate (tracked via `schema_pass`)
- Actionability rubric score
- Specificity-to-data rubric score
- Hallucination penalty rubric score

System
- p95 latency by endpoint
- Error rate (last 24h)
- Copilot request count (last 24h)
- Schema pass rate (last 24h)

## Data Modes

This repo supports multiple data modes via `DATA_MODE`:

- `demo` (default)
  - Fully local deterministic seeded data from `lib/data.js`.
  - Works offline with no external dependencies.

- `live`
  - Fetches a free public dataset for activity (default: `jsonplaceholder.typicode.com/todos`).
  - Caches activity with a TTL.
  - On fetch failure, uses the last-known-good cache.
  - If no cache exists, falls back to demo.
  - Revenue is derived from cached live activity (so it differs from demo).

- `mixed`
  - Demo revenue + cached live activity.

Live caching
- Cache file: `data/live_activity_cache.json` (gitignored)
- TTL controlled by `DATA_CACHE_TTL_SECONDS`.

## Architecture

Frontend (thin client)
- Next.js App Router + Tailwind (JavaScript)
- Components: `Sidebar`, `TopNav`, `MetricCard`, `RevenueChart`, `ActivityTable`, `AnomalyList`, `CopilotPanel`, `SystemHealth`
- Fetches all dashboard data via API routes

Server-side APIs
- `GET /api/revenue` (30-day series + KPIs)
- `GET /api/activity?page=&pageSize=&sortBy=&sortDir=` (paged + sortable activity)
- `GET /api/forecast` (7-day forecast)
- `GET /api/anomalies` (rolling z-score anomalies)
- `POST /api/copilot` (LLM decision support with strict JSON schema)
- `GET /api/metrics` (system health from SQLite logs)

Copilot reliability
- Prompts are versioned on disk in `prompts/`.
- Output is schema-validated and retried once on schema failure.
- If OpenAI is unavailable (missing key or request fails), the endpoint returns a deterministic schema-valid stub.

Observability
- SQLite logging (`data/ops_logs.db`) for every API request:
  - timestamp, endpoint, status_code, latency_ms, error_type
  - copilot adds: model_used, prompt_version, schema_pass

System health
- `/api/metrics` reports p95 latency, error rate, copilot request count, and schema pass rate over the last 24 hours.

## Security

- No secrets are committed.
- Put secrets in `.env.local` (ignored by git).
- `OPENAI_API_KEY` is used server-side only in `/api/copilot`.
  - Do not expose it in client code.
  - Do not use `NEXT_PUBLIC_` for this value.
- `/api/copilot` requires `x-api-key` matching `COPILOT_API_KEY` and is rate-limited (10 req/min/IP).

## Getting Started

### Prereqs
- Node.js 18+

### Install

```bash
npm install
```

### Environment

Create `.env.local` (see `.env.example`):

```bash
# Optional (copilot returns a deterministic stub if missing)
OPENAI_API_KEY=sk-...

# Required to call /api/copilot
COPILOT_API_KEY=dev_local_key

# Data mode (demo|live|mixed)
DATA_MODE=demo
```

### Deploy (Vercel Demo Mode)

This project is designed to deploy cleanly without an OpenAI key.

Required env vars on Vercel
- `DATA_MODE=demo`
- `COPILOT_API_KEY=<any string>`

Intentionally NOT set on Vercel
- `OPENAI_API_KEY` (leave this unset)

When `OPENAI_API_KEY` is missing, `/api/copilot` runs in **Demo AI mode**:
- returns deterministic, schema-valid JSON
- includes `meta.mode="demo"`
- the UI shows a neutral info banner (no scary “OpenAI failed” message)

To enable real AI locally, add `OPENAI_API_KEY` to `.env.local` and restart `npm run dev`.

### Run

```bash
npm run dev
```

Open:
- `http://localhost:3000/dashboard`

### Build

```bash
npm run build
```

(We run webpack builds explicitly to avoid Turbopack environment-specific issues.)

## AI Ops Copilot

Endpoint: `POST /api/copilot`

Headers:
- `Content-Type: application/json`
- `x-api-key: <COPILOT_API_KEY>`

Body:
```json
{
  "query": "Why did revenue dip last week and what should ops do next?",
  "prompt_version": "v1"
}
```

Prompt versioning:
- `prompts/copilot_v1.md` (default)
- `prompts/copilot_v2.md` (stricter)

## Eval Harness

Run:

```bash
npm run eval
```

What it does
- Runs test cases from `eval/test_cases.jsonl`
- Calls the Copilot API for each case
- Scores outputs:
  - schema compliance
  - actionability
  - specificity-to-data
  - hallucination penalty
- Writes results:
  - `eval/results/latest.json`
  - `eval/results/latest.md`

Optional env vars
- `EVAL_START_SERVER=0` to use an already-running dev server
- `EVAL_BASE_URL=http://127.0.0.1:3000` to point at a different server
- `EVAL_PORT=3100` to change the eval server port

Rubric reference: `prompts/rubric.md`

## Decisions Log

See `docs/decisions.md` for key design decisions and tradeoffs.
# ops-dashboard-ai
