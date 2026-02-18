# Arquitetura Técnica

## Decisões
- Banco principal: PostgreSQL (consistência transacional e billing).
- Multi-tenant: coluna `tenant_id` + RLS.
- Arquitetura: monólito modular evolutivo.
- Mensageria: RabbitMQ para throughput, retry e DLQ.
- Rate limit: Redis token bucket por plano/tenant/canal.

## Módulos
- auth
- tenants
- users
- contacts
- templates
- campaigns
- dispatch
- webhooks
- billing
- metrics
- audit

## Fluxo de envio
1. Criação de campanha.
2. Validação de plano e limites.
3. Geração de jobs por contato.
4. Publicação em fila RabbitMQ.
5. Worker consome e envia para Meta Cloud API.
6. Webhook retorna status.
7. Atualização de métricas e billing.

## Escalabilidade
- API e worker stateless com autoscaling.
- Particionamento de tabelas de alto volume.
- Read replicas para consulta.
- Extração gradual de serviços críticos (dispatch/webhooks/billing).
