# SaaS WhatsApp Cloud API

Projeto base para uma plataforma SaaS multi-tenant de disparo automatizado via WhatsApp Business Cloud API.

## Stack
- API: NestJS + TypeScript
- Worker: Node.js + TypeScript
- Banco: PostgreSQL
- Cache/Rate limit: Redis
- Fila: RabbitMQ
- Observabilidade: Prometheus + Alertmanager + Grafana

## Estrutura
- `docs/architecture.md`: arquitetura técnica
- `sql/migrations/`: migrações versionadas
- `api/`: aplicação HTTP (BFF/API)
- `worker/`: consumidores de fila e envio assíncrono
- `docker-compose.yml`: ambiente local

## Ambiente local
1. Copie `.env.example` para `.env` em `api/` e `worker/`.
2. Execute `docker compose up -d`.
3. Execute migrações: `cd api && npm run migrate`.
4. Inicie API e worker.

## Observabilidade local
- Prometheus: `http://localhost:9090`
- Alertmanager: `http://localhost:9093`
- Grafana: `http://localhost:3001` (datasource Prometheus provisionado automaticamente)
- Dashboard provisionado automaticamente: `SLO Baseline - SaaS WhatsApp`

## SLOs
- Política inicial de SLO: `docs/slo-policy.md`

## Database Phase 2
- Modelo e ER textual: `docs/database-phase2-postgresql.md`
- Migration evolutiva: `sql/migrations/0003_saas_multitenant_phase2.sql`
- Script completo (bootstrap): `sql/phase2_full_schema.sql`
