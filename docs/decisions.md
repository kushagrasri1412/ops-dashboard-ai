# Architecture Decisions

This doc captures the key tradeoffs and “why” behind major choices in this repo.

## 1) DATA_MODE and Resilient Live Data

Decision
- Add `DATA_MODE=demo|live|mixed`.

Why
- Demo mode must work offline with deterministic data.
- Live/mixed modes prove real-world resilience patterns: caching, TTLs, and last-known-good fallbacks.

Implementation
- Demo: deterministic seeded generators in `lib/data.js`.
- Live: `lib/liveActivity.js` fetches a free public dataset and writes `data/live_activity_cache.json` with a TTL.
- If refresh fails, the server uses the last-known-good cache; if no cache exists, it falls back to demo.
- Mixed: demo revenue + live activity cache.

Dataset choice
- `jsonplaceholder.typicode.com/todos` because it is free, stable, public, and requires no API key.

## 2) Thin Client + Server-Side APIs

Decision
- The UI fetches all operational data via API routes.

Why
- Mirrors production dashboards: consistent data contracts, observability, and the ability to swap data sources without rewriting UI.

## 3) Structured Copilot Outputs (Schema-Enforced)

Decision
- The Copilot endpoint returns a strict JSON shape:
  - `summary`
  - `key_drivers`
  - `recommended_actions[{action, reason, priority}]`
  - `confidence`
  - `used_data_points`

Why
- Reliable UI rendering and measurable quality.
- Enables eval scoring and monitoring schema compliance.

## 4) Prompt Versioning on Disk

Decision
- Prompts live in `prompts/` and are selected by `prompt_version`.

Why
- Makes prompt changes code-reviewable and testable.
- Supports eval harness comparisons.

## 5) Monitoring via SQLite

Decision
- Log every API request to SQLite with latency + status + endpoint.
- Copilot logs also include model, prompt version, and schema-pass signal.

Why
- Lightweight observability with no external infra.
- Enables a system health widget and metrics endpoint.

## 6) Eval Harness

Decision
- Provide `npm run eval` to run a realistic test set and emit `eval/results/latest.json` + `latest.md`.

Why
- Demonstrates “real AI engineering”: schema compliance, actionability, specificity, and hallucination penalties.

## 7) Build Mode

Decision
- `npm run build` uses webpack explicitly.

Why
- Avoids Turbopack environment-specific issues and keeps CI builds predictable.
