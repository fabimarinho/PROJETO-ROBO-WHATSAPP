<<<<<<< HEAD
﻿# SaaS WhatsApp Cloud API

Projeto base para uma plataforma SaaS multi-tenant de disparo automatizado via WhatsApp Business Cloud API.

## Stack
- API: NestJS + TypeScript
- Worker: Node.js + TypeScript
- Banco: PostgreSQL
- Cache/Rate limit: Redis
- Fila: RabbitMQ
- Observabilidade: OpenTelemetry (planejado)

## Estrutura
- `docs/architecture.md`: arquitetura técnica
- `sql/001_init.sql`: schema inicial multi-tenant
- `api/`: aplicação HTTP (BFF/API)
- `worker/`: consumidores de fila e envio assíncrono
- `docker-compose.yml`: ambiente local

## Subir ambiente local
1. Copie `.env.example` para `.env`.
2. Execute `docker compose up -d`.
3. Aplique o schema: `docker exec -i robo-whatsapp-postgres psql -U app -d robo_whatsapp < sql/001_init.sql`.

## Próximos passos
1. Implementar autenticação JWT + RBAC.
2. Implementar módulo de tenants e RLS no app.
3. Implementar campanhas, dispatcher e integração com Meta API.
4. Implementar webhook de status e métricas.
=======
# PROJETO-ROBO-WHATSAPP
>>>>>>> 4fbfd012874bca300856ca0a38f57c4b5d7181f4
