# Phase 3 Deploy and Rollback Checklist

Date: 2026-02-24  
Branch: `release/phase3-clean-architecture`

## 1) Pre-deploy (staging)
- [ ] Confirm `docker compose up -d` healthy for `postgres`, `redis`, `rabbitmq`, `api`, `worker`.
- [ ] Verify migrations status:
  - `npm run migrate:status --prefix api`
  - expected: `0001`..`0007` as `APPLIED`.
- [ ] Run build gates:
  - `npm run build --prefix api`
  - `npm run build --prefix worker`
- [ ] Run test gates:
  - `npm run test --prefix api`
  - `npm run test:integration --prefix api`
  - `npm run test --prefix worker`
  - `npm run test:integration --prefix worker`

## 2) Deploy (production sequence)
- [ ] Backup snapshot before migration.
- [ ] Apply database migration:
  - `npm run migrate --prefix api`
- [ ] Deploy API with new envs:
  - `JWT_REFRESH_SECRET`
  - `JWT_ACCESS_TTL_SECONDS`
  - `JWT_REFRESH_TTL_SECONDS`
  - `TENANT_RATE_LIMITS_PER_MINUTE`
  - `REDIS_URL`/`REDIS_HOST`/`REDIS_PORT`
- [ ] Deploy worker with BullMQ entrypoint:
  - `npm run start:bullmq --prefix worker`
- [ ] Smoke tests:
  - Auth login + refresh token.
  - Campaign launch -> queue -> message processing.
  - Webhook signature validation.
  - Billing usage query.

## 3) Observability checks
- [ ] API logs structured JSON visible.
- [ ] Worker logs and queue throughput visible.
- [ ] No abnormal growth in `message.send.dlq`.
- [ ] Error rate and latency within defined SLO.

## 4) Rollback strategy
- [ ] Application rollback first:
  - Revert API + worker images/artifacts to previous stable release.
- [ ] Keep migration `0007` (forward-compatible table add).
- [ ] If queue instability:
  - Stop BullMQ worker.
  - Temporarily restart legacy worker path (`npm run start --prefix worker`) until fix.
- [ ] Restore snapshot only if critical data corruption is detected.

## 5) Exit criteria
- [ ] 24h without critical incident.
- [ ] Auth refresh rotation stable.
- [ ] Queue retries bounded and DLQ under threshold.
- [ ] Formal go/no-go recorded by engineering.
