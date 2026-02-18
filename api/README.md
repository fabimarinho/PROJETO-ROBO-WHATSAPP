# Projeto API

## Segurança e persistência implementadas
- JWT Bearer Token
- Guard global de autenticação
- Guard de acesso por tenant (`tenant_id` via membership)
- RBAC por tenant com roles: `owner`, `admin`, `operator`, `viewer`
- Persistência real em PostgreSQL para:
  - `users`
  - `tenants`
  - `tenant_users` (memberships)
  - `contacts`
  - `templates`
  - `campaigns`
  - `campaign_messages`
  - `usage_counters`

## Mensageria
- Publisher RabbitMQ no `launch` de campanha (`campaign.launch`)
- Worker expande contatos e gera jobs por mensagem (`message.send`)

## Webhooks Meta
- `GET /v1/webhooks/meta/whatsapp/:tenantId` (verificação)
- `POST /v1/webhooks/meta/whatsapp/:tenantId` (recebimento)
- Validação HMAC via `x-hub-signature-256`
- Persistência em `webhook_events`
- Reconciliação de status em `campaign_messages` por `meta_message_id`
- Consolidação de billing diário em `usage_counters` por tenant

## Endpoints
- `GET /v1/health` (público)
- `POST /v1/auth/login` (público)
- `GET /v1/auth/me`
- `POST /v1/tenants`
- `GET /v1/tenants`
- `GET /v1/tenants/:tenantId`
- `POST /v1/tenants/:tenantId/contacts`
- `POST /v1/tenants/:tenantId/contacts/import-csv`
- `GET /v1/tenants/:tenantId/contacts`
- `POST /v1/tenants/:tenantId/campaigns`
- `GET /v1/tenants/:tenantId/campaigns`
- `POST /v1/tenants/:tenantId/campaigns/:campaignId/launch`
- `GET /v1/tenants/:tenantId/campaigns/:campaignId/metrics`

## Usuário bootstrap
- Email padrão: `admin@demo.com`
- Senha padrão: `admin123`

## Variáveis de ambiente
- `JWT_SECRET`
- `DATABASE_URL` (preferencial)
- `RABBITMQ_URL`
- `RABBITMQ_CAMPAIGN_QUEUE`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`

## Execução
1. `npm install`
2. subir infraestrutura: `docker compose up -d`
3. aplicar SQL: `sql/001_init.sql` e `sql/002_campaign_message_indexes.sql`
4. `npm run start`
