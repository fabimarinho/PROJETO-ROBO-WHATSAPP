# Message Humanization Engine (Fase 4)

## Objetivo
Gerar mensagens levemente diferentes por contato/campanha para reduzir padrão repetitivo mantendo consistência de comunicação.

## Recursos
- Variáveis dinâmicas: `{{nome}}`, `{{cidade}}`.
- Banco de variações por perfil (`openers`, `bodies`, `closings`).
- Rotação automática (`round_robin` ou `random`).
- Pequenas variações sintáticas por nível (`0..3`).
- Delay aleatório por mensagem (`min_delay_ms..max_delay_ms`).

## Modelo de dados
Migration: `sql/migrations/0008_message_humanization_engine.sql`

Tabelas:
- `message_variation_profiles`
  - banco configurável de frases e parâmetros.
- `campaign_message_humanization_settings`
  - associação de perfil por campanha + estado de rotação.
- `message_variation_events`
  - trilha de auditoria das variações geradas.

## API
Endpoints por campanha:
- `POST /v1/tenants/:tenantId/campaigns/:campaignId/humanization-config`
- `GET /v1/tenants/:tenantId/campaigns/:campaignId/humanization-config`
- `GET /v1/tenants/:tenantId/campaigns/:campaignId/humanization-preview?contactId=<id>&count=<n>`

Implementação:
- `api/src/modules/messaging/message-variation.service.ts`

## Worker (BullMQ)
Aplicação real da variação no pipeline de envio:
- arquivo: `worker/src/bullmq-worker.ts`
- engine: `worker/src/core/message-variation-engine.ts`

Fluxo:
1. Worker carrega configuração de humanização da campanha.
2. Para cada contato, gera variante com rotação + variáveis + sintaxe.
3. Persiste texto gerado em `messages.payload_jsonb.humanization`.
4. Registra evento em `message_variation_events`.
5. Aplica delay aleatório no `message.send`.
6. Envia texto humanizado (quando presente) para WhatsApp; fallback para template.

## Exemplo de configuração
```json
{
  "enabled": true,
  "rotationStrategy": "round_robin",
  "baseTemplateText": "Tudo bem em {{cidade}}? Posso te mostrar uma ideia rapida?",
  "phraseBank": {
    "openers": ["Oi {{nome}}", "Ola {{nome}}"],
    "bodies": ["Vi algo que pode te ajudar em {{cidade}}", "Tenho uma sugestao curta para {{cidade}}"],
    "closings": ["Se fizer sentido, te explico em 1 min.", "Se quiser, envio um resumo objetivo."]
  },
  "syntacticVariationLevel": 2,
  "minDelayMs": 400,
  "maxDelayMs": 1800
}
```
