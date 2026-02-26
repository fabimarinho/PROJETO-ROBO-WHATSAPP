# SaaS WhatsApp Cloud API - Backend (Fase 3)

Backend SaaS multi-tenant com NestJS + Node.js, seguindo Clean Architecture/DDD em módulos de domínio.

## Módulos
- `auth`: login JWT + refresh token rotativo.
- `users`: gestão de usuários por tenant.
- `tenants`: lifecycle de tenants e memberships.
- `campaigns`: criação e lançamento de campanhas.
- `contacts`: cadastro/importação de contatos.
- `messaging`: orquestração de envio template WhatsApp.
- `billing`: leitura de consumo por tenant.
- `webhooks`: recebimento de eventos Meta/WhatsApp.
- `queue`: produtor BullMQ.

## Requisitos implementados
- JWT access token + refresh token.
- RBAC por papel (`owner`, `admin`, `operator`, `viewer`).
- Rate limit por tenant com Redis (fallback local in-memory).
- Logs estruturados JSON.
- Interceptors globais (logging HTTP e envelope de resposta).
- Middlewares de segurança (helmet + request-id).
- Integração WhatsApp Business Cloud API.
- Webhook da Meta com validação de assinatura.
- BullMQ com worker isolado, retry/backoff, delay aleatório, concorrência e DLQ.
- Seleção de engine de fila no worker via `QUEUE_ENGINE` (`bullmq`/`rabbitmq`).
- Engine interna de humanização de mensagens por campanha.
- Billing recorrente com Stripe (plan sync, assinatura mensal, upgrade/downgrade, cancelamento).
- Webhook Stripe com assinatura HMAC, idempotência e trilha auditável.
- Bloqueio de disparo por inadimplência e por limite mensal de mensagens do plano.

## Estrutura
- `api/src/modules/*`: módulos de domínio.
- `api/src/shared/*`: cross-cutting concerns.
- `worker/src/bullmq-worker.ts`: worker BullMQ isolado.
- `web/src/*`: painel administrativo React (fase frontend).
- `sql/migrations/*`: migrações versionadas.
- `docker-compose.yml`: stack local completa.

## Setup local
1. Copie:
   - `.env.example` -> `.env` (raiz)
   - `api/.env.example` -> `api/.env`
   - `worker/.env.example` -> `worker/.env`
2. O default do projeto para Postgres host-side e `5433` para evitar conflito com instalacao local em `5432`.
3. Suba infra/app:
   - `docker compose up -d`
4. Rodar manualmente sem docker (opcional):
   - API: `npm run migrate --prefix api` e `npm run start --prefix api`
   - Worker: `npm run start:bullmq --prefix worker`

## Comandos úteis
- `npm run test --prefix api`
- `npm run test:integration --prefix api`
- `npm run test --prefix worker`
- `npm run test:integration --prefix worker`
- `npm run build --prefix api`
- `npm run build --prefix worker`

## Migrações da fase 3
- `0007_auth_refresh_tokens.sql`: persistência de refresh tokens.
- `0008_message_humanization_engine.sql`: banco e estado de humanização.
- `0010_billing_stripe_recurring.sql`: recorrencia Stripe, historico financeiro e auditoria.

## Documentação técnica fase 4
- `docs/message-humanization-engine.md`
- `docs/devops-phase7.md`

## Observações arquiteturais
- Isolamento multi-tenant por `tenant_id` + RLS.
- Contrato de sessão de tenant via `SET LOCAL app.tenant_id` transacional.
- Fila principal BullMQ em Redis com DLQ lógica (`message.send.dlq`).
