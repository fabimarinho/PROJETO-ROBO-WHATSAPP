# Projeto API

## Segurança e persistência implementadas
- JWT Bearer Token
- Guard global de autenticação
- Guard de acesso por tenant (`tenant_id` via membership)
- RBAC por tenant com roles: `owner`, `admin`, `operator`, `viewer`
- Persistência real em PostgreSQL para domínios principais

## Endurecimentos recentes
- Sem fallback inseguro de `JWT_SECRET`
- Bootstrap admin só quando `BOOTSTRAP_ADMIN_ENABLED=true`
- Webhook rejeita assinatura inválida (401)
- Reconciliação de webhook com contagem idempotente para billing

## Observabilidade básica
- `GET /v1/health`: status + check de banco
- `GET /v1/metrics`: formato Prometheus
- `GET /v1/metrics/json`: snapshot interno
- logging HTTP estruturado por requisição

## Migrações
- Migrações versionadas em `../sql/migrations`
- `npm run migrate`
- `npm run migrate:status`

## Testes
- `npm run test` (unit tests)

## Endpoints principais
- `POST /v1/auth/login`
- `POST /v1/tenants`
- `POST /v1/tenants/:tenantId/contacts/import-csv`
- `POST /v1/tenants/:tenantId/campaigns/:campaignId/launch`
- `POST /v1/webhooks/meta/whatsapp/:tenantId`
