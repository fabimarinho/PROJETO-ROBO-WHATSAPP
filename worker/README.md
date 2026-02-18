# Projeto Worker

Worker real com:
- consumo RabbitMQ (`campaign.launch`)
- retry com backoff simples (`campaign.launch.retry`)
- dead-letter queue (`campaign.launch.dlq`)
- atualização de status de campanha no PostgreSQL

## Variáveis de ambiente
- `DATABASE_URL`
- `RABBITMQ_URL`
- `RABBITMQ_CAMPAIGN_QUEUE`
- `WORKER_MAX_ATTEMPTS`
- `WORKER_FORCE_FAIL`

## Execução
1. `npm install`
2. `npm run start`
