# Worker (BullMQ) - Fase 3

Worker isolado para processamento assíncrono com Redis/BullMQ.

## Filas
- `campaign.launch`
- `message.send`
- `message.send.dlq` (dead-letter lógica)

## Recursos
- Retry automático (`attempts` + backoff exponencial).
- Delay aleatório configurável no produtor.
- Controle de concorrência por worker.
- Rate limit por plano (Redis).
- Integração WhatsApp Cloud API.

## Comandos
- `npm run start` (worker legado RabbitMQ)
- `npm run start:bullmq` (worker fase 3)
- `npm run build`
- `npm run test`
- `npm run test:integration`

## Variáveis principais
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `BULLMQ_CAMPAIGN_QUEUE`
- `BULLMQ_MESSAGE_QUEUE`
- `BULLMQ_MAX_ATTEMPTS`
- `BULLMQ_RETRY_DELAY_MS`
- `BULLMQ_WORKER_CONCURRENCY`
- `PLAN_LIMITS_PER_MINUTE`
- `META_GRAPH_VERSION`
- `META_PHONE_NUMBER_ID`
- `META_ACCESS_TOKEN`
