# API (NestJS) - Fase 3

## Módulos
- `auth`, `users`, `tenants`, `campaigns`, `contacts`, `messaging`, `billing`, `webhooks`, `queue`

## Segurança
- JWT access token + refresh token rotativo.
- Guard global de autenticação.
- RBAC por tenant (`owner`, `admin`, `operator`, `viewer`).
- Rate limit por tenant (Redis + fallback in-memory).
- Middlewares: `helmet` + `x-request-id`.

## Observabilidade
- Logs estruturados JSON.
- Interceptors globais para logging e envelope de resposta.
- `GET /v1/health`
- `GET /v1/metrics`
- `GET /v1/metrics/json`

## Queue
- Produtor BullMQ:
  - `campaign.launch`
  - `message.send`

## Migrações
- `npm run migrate`
- `npm run migrate:status`
- Fase 3: `0007_auth_refresh_tokens.sql`

## Comandos
- `npm run start`
- `npm run build`
- `npm run test`
- `npm run test:integration`
