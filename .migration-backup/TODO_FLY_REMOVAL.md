# Fly.io removal checklist

- [x] Identify Fly configuration file(s)
- [x] Remove `artifacts/api-server/fly.toml`

- [x] Verify repo no longer contains `fly.toml` (none found in artifacts/api-server)

- [x] Remove Fly.io GitHub Action workflow (.github/workflows/deploy-api-fly.yml)
- [ ] Commit-ready: run typecheck/build (optional)

