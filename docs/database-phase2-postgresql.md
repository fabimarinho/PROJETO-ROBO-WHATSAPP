# PostgreSQL Model - Fase 2 (SaaS Multi-tenant)

## Tenant Strategy
- Model: row-level `tenant_id` (single schema).
- Logical isolation: all core domain entities include `tenant_id`.
- Scale path: composite indexes starting with `tenant_id` for critical queries.
- Production security next step: enable RLS on critical tenant tables.

## Textual ER Diagram
- `tenants (1) -> (N) subscriptions`
- `plans (1) -> (N) subscriptions`
- `tenants (1) -> (N) roles`
- `tenants (1) -> (N) tenant_users`
- `users (1) -> (N) tenant_users`
- `roles (1) -> (N) tenant_users` (composite FK `role_id + tenant_id`)
- `tenants (1) -> (N) whatsapp_accounts`
- `tenants (1) -> (N) contacts`
- `tenants (1) -> (N) campaigns`
- `campaigns (1) -> (N) campaign_contacts`
- `contacts (1) -> (N) campaign_contacts`
- `campaign_contacts (1) -> (N) messages`
- `campaigns (1) -> (N) messages`
- `contacts (1) -> (N) messages`
- `whatsapp_accounts (1) -> (N) messages`
- `messages (1) -> (N) message_logs`
- `tenants (1) -> (N) webhooks`
- `tenants (1) -> (N) audit_logs`
- `users (1) -> (N) audit_logs` (optional actor)
- `tenants (1) -> (N) api_keys`
- `users (1) -> (N) api_keys` (optional creator)

## Required Tables (Phase 2)
- `tenants` (existing, kept)
- `users` (existing, evolved with status/audit/soft delete)
- `roles` (new)
- `subscriptions` (new)
- `plans` (new)
- `whatsapp_accounts` (new)
- `campaigns` (existing, evolved with soft delete and WhatsApp account link)
- `contacts` (existing, evolved with soft delete)
- `campaign_contacts` (new)
- `messages` (new)
- `message_logs` (new)
- `webhooks` (new)
- `audit_logs` (new)
- `api_keys` (new)

## Integrity and Constraints
- Foreign keys with `on delete cascade` for strict tenant-owned data.
- `check constraints` for controlled state columns (`status`, `billing_period`, `direction`, `actor_type`).
- Idempotency and uniqueness:
  - `messages (tenant_id, idempotency_key)`
  - `messages (tenant_id, provider_message_id)` partial unique index
  - `webhooks (tenant_id, source, external_event_id)` partial unique index
  - `subscriptions`: max 1 open subscription per tenant (partial unique index).
- Soft delete (`deleted_at`) for long-lived entities:
  - `plans`, `subscriptions`, `roles`, `users`, `whatsapp_accounts`, `campaigns`, `contacts`, `campaign_contacts`, `messages`, `api_keys`.

## Strategic Indexes
- Composite indexes by `tenant_id` + filter/sort columns:
  - `subscriptions (tenant_id, status, current_period_end desc)`
  - `campaign_contacts (tenant_id, status, created_at desc)`
  - `messages (tenant_id, status, created_at desc)`
  - `messages (tenant_id, campaign_id, created_at desc)`
  - `message_logs (tenant_id, message_id, event_at desc)`
  - `webhooks (tenant_id, status, received_at desc)`
  - `audit_logs (tenant_id, created_at desc)` and `(tenant_id, action, created_at desc)`
  - `api_keys (tenant_id, status, created_at desc)`

## SQL and Migration Versioning
- Main migration: `sql/migrations/0003_saas_multitenant_phase2.sql`
- Mirror operational script: `sql/003_saas_multitenant_phase2.sql`
- Recommended pattern:
  1. `expand`: add columns/tables without breaking current reads/writes.
  2. `backfill`: populate data in idempotent batches.
  3. `switch`: move application reads/writes to new structures.
  4. `contract`: remove legacy only after stability window.
- Good practices:
  - Transactional migrations.
  - Advisory migration lock (already implemented).
  - Prefer forward-fix migrations instead of destructive rollback.

## Backup Strategy (Production)
- Primary DB with WAL archiving for PITR.
- Layers:
  - Daily full snapshot.
  - Continuous WAL/incremental stream (target RPO <= 15 min).
  - Retention: 30 days online + monthly cold copy (90+ days).
- Mandatory restore drill:
  - Every 2 weeks in isolated environment.
  - Validate tenant-critical data, messages, and billing counters.
  - Measure and record real RTO.
- Security:
  - Encryption at rest and in transit.
  - Least-privilege access for backup/restore operators.

## Hardening Pack (Phase 2.1)
- Migration: `sql/migrations/0004_phase2_hardening_tenant_integrity_rls.sql`
- Strict RLS migration: `sql/migrations/0005_phase2_rls_strict_business_tables.sql`
- Constraint validation migration: `sql/migrations/0006_phase2_validate_tenant_constraints.sql`
- Objectives:
  - Enforce tenant-safe referential integrity with composite FKs (`tenant_id`, `id`).
  - Standardize `updated_at` via trigger on mutable tables.
  - Enable Row Level Security on tenant-scoped tables.
  - Add extra read-path indexes for high-volume logs/events.

### RLS session contract
- Application sessions should set tenant context before queries:
  - `set app.tenant_id = '<tenant-uuid>';`
- Current policy is compatibility mode:
  - if `app.tenant_id` is absent, access is allowed (admin/migration sessions).
- Production tightening (recommended after rollout):
  - enforce tenant context in app role and move to strict deny when unset.
  - migration `0005` applies strict mode on business tenant tables.

### Constraint rollout
- Tenant-safe FKs are added as `NOT VALID`:
  - new writes are enforced immediately;
  - legacy rows are validated in controlled windows.
- Suggested command per table after data cleanup:
  - `alter table <table_name> validate constraint <constraint_name>;`
- Finalization:
  - migration `0006` validates all tenant-safe FKs and closes the Phase 2 integrity rollout.
