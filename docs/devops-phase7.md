# DevOps Fase - Plataforma de Producao

## Entregaveis
- `Dockerfile.backend`: build e runtime da API.
- `Dockerfile.worker`: build e runtime do worker.
- `Dockerfile.frontend`: build do SPA e runtime em Nginx.
- `docker-compose.prod.yml`: stack de producao local/staging.
- `infra/nginx/gateway.conf`: reverse proxy edge.
- `infra/nginx/frontend.conf`: entrega SPA com fallback de rota.
- `.github/workflows/cicd.yml`: pipeline CI/CD com deploy ECS.
- `infra/aws/ecs-taskdef-*.json`: task definitions versionadas.

## Pipeline CI/CD
1. Checkout + setup Node 22.
2. `npm ci` em `api`, `worker`, `web`.
3. `lint`, `build` e testes.
4. Build/push de imagens para GHCR.
5. Deploy continuo para AWS ECS (Fargate) com task definition renderizada.

## Variaveis seguras
- Nunca commitar segredos em `.env`.
- Produzir segredos via AWS SSM Parameter Store / Secrets Manager.
- Referenciar no ECS por `containerDefinitions.secrets`.
- Variaveis exemplificadas em:
  - `.env.production.example`
  - `api/.env.production.example`
  - `worker/.env.production.example`
  - `web/.env.production.example`

## Estrategia AWS
- Runtime:
  - ECS Fargate para `backend`, `worker` e `frontend`.
  - ALB na frente dos servicos HTTP (`frontend`/`backend`).
  - RDS PostgreSQL Multi-AZ.
  - ElastiCache Redis.
  - Amazon MQ (RabbitMQ) ou migracao para SQS.
- Deploy:
  - `rolling update` com health checks.
  - Opcional Blue/Green via CodeDeploy para backend.
- Estado:
  - Banco e filas fora dos containers (servicos gerenciados).

## Monitoramento e logs centralizados
- Metricas:
  - Prometheus + regras SLO.
  - Grafana para dashboards.
  - Alertmanager para notificacoes.
- Logs:
  - Promtail coleta stdout dos containers.
  - Loki centraliza e indexa logs.
  - Grafana consulta logs em Loki.
- AWS:
  - Logs aplicacionais tambem em CloudWatch via `awslogs`.

## Escalabilidade horizontal
- Backend:
  - Escala horizontal por replicas ECS atras do ALB.
  - Stateless com sessao em JWT e estado em Postgres/Redis.
- Worker:
  - Escala horizontal por replicas consumidoras BullMQ.
  - Controle de concorrencia por worker e idempotencia por chave.
- Frontend:
  - Escala horizontal via replicas Nginx/SPA.
  - Distribuicao em ALB/CloudFront.
- Banco:
  - Escala vertical + replicas de leitura + particionamento futuro por tenant.
- Picos:
  - HPA/auto scaling por CPU, memoria e profundidade de fila.
