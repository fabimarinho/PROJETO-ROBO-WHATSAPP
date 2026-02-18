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
  - `campaigns`
  - `templates`

## Mensageria
- Publisher RabbitMQ no `launch` de campanha
- Fila padrão: `campaign.launch`

## Webhooks Meta
- `GET /v1/webhooks/meta/whatsapp/:tenantId` (verificação)
- `POST /v1/webhooks/meta/whatsapp/:tenantId` (recebimento)
- Validação HMAC via `x-hub-signature-256`
- Persistência em `webhook_events`

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
3. aplicar schema SQL em `sql/001_init.sql`
4. `npm run start`
