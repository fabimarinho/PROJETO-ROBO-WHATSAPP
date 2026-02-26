# Robo WhatsApp Admin Web

Frontend administrativo SaaS B2B em React + TypeScript + Vite.

## Modulos
- `auth`: login e sessao.
- `dashboard`: metricas operacionais.
- `campaigns`: criacao e disparo de campanhas.
- `upload`: importacao CSV de contatos.
- `templates`: editor de template/humanizacao.
- `billing`: controle de plano e assinatura.
- `whatsapp`: configuracoes do canal.
- `logs`: rastreabilidade de envios.

## Arquitetura
- `src/app`: roteamento e layout global.
- `src/components`: componentes reutilizaveis.
- `src/hooks`: hooks customizados (`useAuth`, `useTenant`, `useDashboardMetrics`).
- `src/lib/api`: cliente HTTP tipado e contratos de dados.
- `src/modules`: paginas por dominio de negocio.

## Execucao
1. Copie `.env.example` para `.env`.
2. Instale dependencias: `npm install`.
3. Rode em dev: `npm run dev`.
4. Build: `npm run build`.

## Integracao API
- Base path: `/v1`.
- Em desenvolvimento, o Vite usa proxy para `http://localhost:3000`.
- Autenticacao via `Authorization: Bearer <token>`.
