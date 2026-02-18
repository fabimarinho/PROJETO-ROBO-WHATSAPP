# Production Readiness Checklist

Plano detalhado de execução: `docs/2-week-execution-plan.md`

## 1) Architecture and Scalability
- [ ] Definir SLOs oficiais (API, webhook, pipeline de envio)
- [ ] Configurar autoscaling por métricas de fila e latência
- [ ] Validar throughput alvo com teste de carga (>= 10x volume do MVP)
- [ ] Definir estratégia de particionamento para tabelas de alto volume

## 2) Security
- [ ] Rotação automática de segredos (JWT, Meta token, DB creds)
- [ ] Política de retenção e mascaramento de dados sensíveis em logs
- [ ] Hardening de webhook (replay protection por timestamp/nonce)
- [ ] Revisão de permissões DB por papel (app, migration, read-only)
- [ ] Plano de resposta a incidentes de segurança

## 3) Data and Migrations
- [x] Migrações versionadas implementadas
- [x] Pipeline CI para validar migrações em banco limpo
- [ ] Política de rollback de migração (expand/contract)
- [ ] Backups automáticos + teste de restore periódico

## 4) Reliability and Operations
- [x] Health check com dependência de banco
- [x] Métricas operacionais básicas
- [ ] Alertas (fila, erro Meta API, DLQ, latência p95)
- [ ] Runbooks de operação (reprocessamento DLQ, modo degradado)
- [ ] Plano de DR com metas RTO/RPO formais

## 5) Testing and Quality
- [x] Testes unitários iniciais
- [ ] Cobertura mínima por domínio crítico (auth, campaigns, webhook, worker)
- [x] Testes de integração com PostgreSQL/RabbitMQ/Redis em CI
- [ ] Testes E2E de fluxo completo campanha -> entrega -> billing

## 6) Billing and Plans
- [x] Consolidação básica de uso (`usage_counters`)
- [ ] Motor de billing com regras comerciais por plano
- [ ] Trilha de auditoria de cobrança e reconciliação financeira
- [ ] Gestão de upgrade/downgrade sem perda de consistência

## 7) Product and API
- [ ] Versionamento semântico da API + política de depreciação
- [ ] Limites de payload e validação formal de contratos (DTOs)
- [ ] Endpoint de exportação de logs/métricas por tenant
- [ ] Documentação OpenAPI/Swagger completa

## 8) Go-live Gate
- [ ] Checklist de readiness assinado por engenharia/segurança/produto
- [ ] Ensaio de incidente (chaos day) em ambiente de staging
- [ ] Aprovação final de observabilidade e alertas
- [ ] Aprovação legal/compliance (LGPD e consentimento)
