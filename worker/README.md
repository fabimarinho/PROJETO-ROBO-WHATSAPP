# Projeto Worker

Worker com pipeline completo:
- `campaign.launch`: expande campanha para `campaign_messages`
- `message.send`: envia cada mensagem para WhatsApp Cloud API
- retry + DLQ para os dois estágios
- atualização de status em PostgreSQL
- rate limit distribuído por plano em Redis

## Filas
- `campaign.launch`
- `campaign.launch.retry` (delay queue com dead-letter para `campaign.launch`)
- `campaign.launch.dlq`
- `message.send`
- `message.send.retry` (delay queue com dead-letter para `message.send`)
- `message.send.dlq`

## Variáveis
- `DATABASE_URL`
- `RABBITMQ_URL`
- `REDIS_URL`
- `RABBITMQ_CAMPAIGN_QUEUE`
- `RABBITMQ_MESSAGE_QUEUE`
- `WORKER_MAX_ATTEMPTS`
- `PLAN_LIMITS_PER_MINUTE`
- `META_GRAPH_VERSION`
- `META_PHONE_NUMBER_ID`
- `META_ACCESS_TOKEN`
- `ALLOW_MOCK_WHATSAPP_SEND`

Sem credenciais da Meta, o worker só entra em mock quando `ALLOW_MOCK_WHATSAPP_SEND=true` e fora de produção.
