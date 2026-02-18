# Plano de Execucao de 2 Semanas (Bloqueadores de Producao)

## Objetivo
Fechar os principais bloqueadores de go-live com foco em seguranca, confiabilidade operacional, qualidade e billing.

## Premissas
- Time base: 1 backend senior + 1 devops senior + 1 QA parcial.
- Janela: 10 dias uteis.
- Ambiente com API, worker, PostgreSQL, Redis, RabbitMQ e stack de observabilidade ja disponiveis.

## Prioridade de Entrega
1. Seguranca e resiliencia (nao negociavel para producao).
2. Operacao (alertas acionaveis + runbooks + DR basico).
3. Qualidade (E2E do fluxo critico e cobertura dos dominos de risco).
4. Billing e governanca de API.

## Semana 1

### Dia 1 - SLOs e baseline operacional
- Escopo:
  - Definir SLOs de API, webhook e pipeline.
  - Definir SLIs em Prometheus.
  - Criar dashboard base de SLI no Grafana.
- Esforco: 1 dia.
- Criterios de aceite:
  - Documento de SLO versionado.
  - 1 dashboard com disponibilidade, latencia p95 e taxa de erro.
  - Alertas alinhados aos SLOs com severidade `warning/critical`.

### Dia 2 - Alertas de producao e roteamento
- Escopo:
  - Completar regras para: latencia p95 API, erro Meta, backlog DLQ, fila principal, taxa de retry.
  - Configurar Alertmanager com receptor real (Slack, PagerDuty ou webhook interno de incidentes).
- Esforco: 1 dia.
- Criterios de aceite:
  - Simulacao de incidente dispara alerta em < 2 min.
  - Alertas com runbook URL nas annotations.
  - Sem alerts flapping em carga normal de homologacao.

### Dia 3 - Hardening de webhook (replay protection)
- Escopo:
  - Implementar validacao de timestamp/nonce com janela de tolerancia (ex.: 5 min).
  - Persistir nonce em Redis com TTL para prevencao de replay.
  - Expandir testes unitarios/integracao de assinatura invalida e replay.
- Esforco: 1 dia.
- Criterios de aceite:
  - Requisicao replay retorna 401/409.
  - Requisicao valida dentro da janela passa.
  - Cobertura de testes para os cenarios de replay >= 90% do modulo webhook.

### Dia 4 - Segredos e permissao de banco
- Escopo:
  - Remover segredos estaticos de `.env` de ambientes persistentes e mover para secret manager.
  - Separar roles de banco: `app_rw`, `migration_admin`, `readonly_audit`.
  - Ajustar CI/CD para injetar segredos via variaveis seguras.
- Esforco: 1 dia.
- Criterios de aceite:
  - Nenhum segredo de producao em arquivo local versionado.
  - Aplicacao sobe com role de menor privilegio.
  - Migracao executa apenas com role dedicada.

### Dia 5 - Runbooks e resposta a incidente
- Escopo:
  - Criar runbooks para: backlog DLQ, erro Meta em massa, degradacao Redis/Rabbit.
  - Criar playbook de incidente de seguranca.
- Esforco: 1 dia.
- Criterios de aceite:
  - Runbooks versionados em `docs/runbooks/`.
  - Cada alerta critico aponta para runbook correspondente.
  - Simulacao tabletop de 30 min com registro de acoes.

## Semana 2

### Dia 6 - Politica de migracao (expand/contract) e rollback
- Escopo:
  - Definir padrao formal de migracao sem downtime.
  - Introduzir checklist de rollback para cada migration critica.
- Esforco: 1 dia.
- Criterios de aceite:
  - Documento de politica de migration em `docs/`.
  - Pelo menos 1 migration de exemplo no padrao expand/contract.
  - Processo de rollback validado em staging.

### Dia 7 - Backups e restore testado
- Escopo:
  - Automatizar backup (snapshot + PITR quando aplicavel).
  - Executar restore em ambiente isolado.
  - Definir RPO/RTO inicial.
- Esforco: 1 dia.
- Criterios de aceite:
  - Job de backup com monitoramento.
  - Restore executado com evidencias.
  - RPO/RTO documentados e aprovados por engenharia.

### Dia 8 - Qualidade: E2E do fluxo critico
- Escopo:
  - Implementar E2E: campanha -> fila -> envio -> webhook -> billing.
  - Cobrir cenarios de erro: retry, DLQ, rate limit e idempotencia webhook.
- Esforco: 1 dia.
- Criterios de aceite:
  - Suite E2E executa em CI.
  - Fluxo feliz e 2 fluxos de falha cobertos.
  - Falha no E2E bloqueia merge.

### Dia 9 - Billing: regras comerciais + auditoria
- Escopo:
  - Implementar motor de regra por plano (franquia, excedente, bloqueio/avisos).
  - Criar trilha de auditoria de cobranca.
  - Cobrir upgrade/downgrade sem perda de consistencia.
- Esforco: 1 dia.
- Criterios de aceite:
  - Casos de cobranca reproduziveis por teste.
  - Eventos de billing auditaveis por tenant e periodo.
  - Mudanca de plano sem contador inconsistente.

### Dia 10 - Gate de go-live
- Escopo:
  - Definir versionamento semantico e politica de deprecacao.
  - Fechar OpenAPI minimo.
  - Executar checklist final com aprovacao cruzada.
- Esforco: 1 dia.
- Criterios de aceite:
  - Checklist de readiness com status por area.
  - OpenAPI publicado para rotas criticas.
  - Decisao formal: go/no-go registrada.

## Quadro de Esforco Consolidado
- Seguranca: 3 dias.
- Operacao/Confiabilidade: 3 dias.
- Dados/Migracoes/DR: 2 dias.
- Qualidade: 1 dia.
- Billing e governanca de API: 1 dia.

## Dependencias Criticas
- Acesso a provedor de segredos e IAM.
- Canal de alerta real (Slack/PagerDuty/Webhook interno).
- Ambiente staging estavel com dados de teste realistas.

## Riscos e Mitigacoes
- Risco: Alertas ruidosos gerarem fadiga.
  - Mitigacao: calibrar thresholds em staging com carga controlada.
- Risco: Mudancas de billing afetarem receita.
  - Mitigacao: testes de regressao financeiros + reconciliacao por amostragem.
- Risco: Falhas de restore aparecerem apenas em incidente real.
  - Mitigacao: restore drill obrigatorio quinzenal.

## Definicao de Concluido da Etapa
- Nenhum item critico de seguranca e operacao pendente.
- E2E critico ativo em CI.
- Runbooks e DR testados.
- Aprovacao conjunta de engenharia, produto e seguranca para avancar ao hardening final de producao.
