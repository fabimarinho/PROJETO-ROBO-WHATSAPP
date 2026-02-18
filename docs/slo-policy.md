# SLO Policy (Baseline)

## Escopo
Servicos cobertos nesta baseline:
- API HTTP (`/v1/*`)
- Webhook da Meta (`/v1/webhooks/*`)
- Pipeline assíncrono (campaign launch -> message send)

## SLOs Oficiais (Semana 1)

### 1) Disponibilidade da API
- Indicador: taxa de sucesso HTTP (1 - erro 5xx/request total).
- Janela: 5 minutos (operacional) e 30 dias (gerencial).
- Meta:
  - Operacional: >= 99.5% em 5m.
  - Mensal: >= 99.9%.
- Query operacional:
  - `app:availability_ratio_5m`

### 2) Latência da API
- Indicador: p95 de latência em ms.
- Janela: 5 minutos.
- Meta:
  - p95 <= 800ms (warning acima disso).
  - p95 <= 1200ms (critical acima disso).
- Query:
  - `app:request_latency_p95_ms_5m`

### 3) Saúde do Pipeline de Envio
- Indicadores:
  - backlog em DLQ.
  - taxa de falha permanente.
  - eventos de rate limit.
- Metas operacionais:
  - `sum(worker_queue_depth{queue=~".*\\.dlq"}) == 0` por padrão.
  - `increase(worker_messages_failed_permanent_total[5m])` sem picos sustentados.
  - `increase(worker_messages_rate_limited_total[5m])` dentro da faixa esperada por plano.

## Error Budget (API)
- Objetivo mensal: 99.9%.
- Orçamento de erro mensal aproximado: 43m 49s de indisponibilidade equivalente.

## Governança
- Revisão semanal dos SLOs: Engenharia + Produto.
- Qualquer mudança de meta exige PR com:
  - justificativa técnica,
  - impacto em custo/capacidade,
  - plano de mitigação.
