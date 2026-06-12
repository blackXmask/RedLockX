# PromptFW — Prompt Injection Firewall

A threat intelligence dashboard that analyzes user-submitted prompts for injection attacks using two parallel AI models, returning a real-time BLOCK/ALLOW verdict.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/firewall-ui run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `HYBRID_SPACE_URL` — HuggingFace Hybrid Space endpoint (XGBoost + embeddings)
- Optional env: `ML_SPACE_URL` — HuggingFace DeBERTa Space endpoint

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, TailwindCSS, Recharts, React Query

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/analysisLogs.ts` — DB schema for analysis_logs table
- `artifacts/api-server/src/routes/analyze.ts` — parallel model invocation + decision logic
- `artifacts/api-server/src/routes/logs.ts` — log history endpoints
- `artifacts/api-server/src/routes/stats.ts` — analytics/stats endpoints
- `artifacts/firewall-ui/src/` — React frontend

## Architecture decisions

- When `HYBRID_SPACE_URL` / `ML_SPACE_URL` are not set, the server uses a deterministic simulation based on keyword matching. This makes the app fully functional without HuggingFace access.
- Both models run in parallel via `Promise.all` for minimum latency.
- Risk score uses a weighted blend: `(0.6 * hybridProb) + (0.4 * mlConfidence)` when ML says DANGEROUS.
- Verdict is BLOCK if `hybridProb > 0.5 OR mlStatus == "DANGEROUS"`.
- All analysis results are persisted to PostgreSQL immediately after scoring.

## Product

- **Analyzer** (`/`) — paste any prompt, see verdict (BLOCK/ALLOW), risk %, attack type, model confidence, and explanation
- **Logs** (`/logs`) — paginated history of all analyses with filterable verdicts
- **Dashboard** (`/dashboard`) — stats cards, attack-type distribution chart, 7-day activity chart

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do not change `info.title` in `openapi.yaml` — Orval uses it to derive generated filenames
- Body schemas must use entity-shaped names (`PromptInput`) not operation-shaped (`AnalyzePromptBody`) to avoid TS2308 collisions
- After any spec change, always run `pnpm --filter @workspace/api-spec run codegen`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
