# SaaS WhatsApp Cloud API

Projeto base para uma plataforma SaaS multi-tenant de disparo automatizado via WhatsApp Business Cloud API.

## Stack
- API: NestJS + TypeScript
- Worker: Node.js + TypeScript
- Banco: PostgreSQL
- Cache/Rate limit: Redis
- Fila: RabbitMQ

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
