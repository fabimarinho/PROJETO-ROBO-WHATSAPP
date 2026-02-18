# Production Readiness Checklist

Plano detalhado de execucao: `docs/2-week-execution-plan.md`

## 1) Architecture and Scalability
- [ ] Definir SLOs oficiais (API, webhook, pipeline de envio)
- [ ] Configurar autoscaling por mÃ©tricas de fila e latÃªncia
- [ ] Validar throughput alvo com teste de carga (>= 10x volume do MVP)
- [ ] Definir estratÃ©gia de particionamento para tabelas de alto volume

## 2) Security
- [ ] RotaÃ§Ã£o automÃ¡tica de segredos (JWT, Meta token, DB creds)
- [ ] PolÃ­tica de retenÃ§Ã£o e mascaramento de dados sensÃ­veis em logs
- [ ] Hardening de webhook (replay protection por timestamp/nonce)
- [ ] RevisÃ£o de permissÃµes DB por papel (app, migration, read-only)
- [ ] Plano de resposta a incidentes de seguranÃ§a

## 3) Data and Migrations
- [x] MigraÃ§Ãµes versionadas implementadas
- [x] Pipeline CI para validar migraÃ§Ãµes em banco limpo
- [ ] PolÃ­tica de rollback de migraÃ§Ã£o (expand/contract)
- [ ] Backups automÃ¡ticos + teste de restore periÃ³dico

## 4) Reliability and Operations
- [x] Health check com dependÃªncia de banco
- [x] MÃ©tricas operacionais bÃ¡sicas
- [ ] Alertas (fila, erro Meta API, DLQ, latÃªncia p95)
- [ ] Runbooks de operaÃ§Ã£o (reprocessamento DLQ, modo degradado)
- [ ] Plano de DR com metas RTO/RPO formais

## 5) Testing and Quality
- [x] Testes unitÃ¡rios iniciais
- [ ] Cobertura mÃ­nima por domÃ­nio crÃ­tico (auth, campaigns, webhook, worker)
- [x] Testes de integraÃ§Ã£o com PostgreSQL/RabbitMQ/Redis em CI
- [ ] Testes E2E de fluxo completo campanha -> entrega -> billing

## 6) Billing and Plans
- [x] ConsolidaÃ§Ã£o bÃ¡sica de uso (`usage_counters`)
- [ ] Motor de billing com regras comerciais por plano
- [ ] Trilha de auditoria de cobranÃ§a e reconciliaÃ§Ã£o financeira
- [ ] GestÃ£o de upgrade/downgrade sem perda de consistÃªncia

## 7) Product and API
- [ ] Versionamento semÃ¢ntico da API + polÃ­tica de depreciaÃ§Ã£o
- [ ] Limites de payload e validaÃ§Ã£o formal de contratos (DTOs)
- [ ] Endpoint de exportaÃ§Ã£o de logs/mÃ©tricas por tenant
- [ ] DocumentaÃ§Ã£o OpenAPI/Swagger completa

## 8) Go-live Gate
- [ ] Checklist de readiness assinado por engenharia/seguranÃ§a/produto
- [ ] Ensaio de incidente (chaos day) em ambiente de staging
- [ ] AprovaÃ§Ã£o final de observabilidade e alertas
- [ ] AprovaÃ§Ã£o legal/compliance (LGPD e consentimento)
