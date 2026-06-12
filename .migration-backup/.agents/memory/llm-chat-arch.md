---
name: LLM Chat Architecture
description: How the firewall-gated chat feature is structured and key gotchas
---

# Firewall-Gated Chat Architecture

## Key rule
`zod` must be listed as a direct dependency in `artifacts/api-server/package.json`. The api-server esbuild bundler resolves packages from its own node_modules — importing zod in routes without it being a declared dependency causes a build failure.

**Why:** api-server uses esbuild to bundle (not tsc), so transitive availability via workspace doesn't help. Declared deps must be explicit.

**How to apply:** Any time a new package is used directly in api-server route/lib code, add it with `pnpm --filter @workspace/api-server add <pkg>`.

## Shared analysis engine
`artifacts/api-server/src/lib/analyze-engine.ts` exports `runAnalysis(prompt)` — both the `/analyze` route and `/chat` route import from it. Never duplicate the Gradio call logic.

## LLM settings storage
One-row pattern in `llm_settings` table. Settings route does select-then-update-or-insert by ID. GET /settings returns masked response (hasApiKey: bool, no raw key).

## Provider dispatch
- openai/groq/custom → OpenAI-compatible POST /chat/completions
- gemini → Google generateContent API with `?key=` query param
- Custom provider uses `settings.baseUrl` as the OpenAI-compatible base URL.
