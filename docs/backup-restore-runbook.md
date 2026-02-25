# PostgreSQL Backup and Restore Runbook

## Scope
- Environment: production multi-tenant PostgreSQL.
- Objective: support full recovery + point-in-time recovery (PITR).
- Target baseline:
  - RPO <= 15 minutes
  - RTO <= 60 minutes (validate with drills)

## Backup Policy
1. Daily logical backup (`pg_dump`) for portability.
2. Continuous WAL archiving for PITR.
3. Weekly base backup (`pg_basebackup`) for faster restore.
4. Retention:
  - Daily backups: 30 days
  - Weekly base backups: 8 weeks
  - Monthly cold copy: 90+ days

## Reference Commands
```bash
# Logical backup (custom format)
pg_dump "$DATABASE_URL" -Fc -f /backups/app_$(date +%F).dump

# Cluster base backup (physical)
pg_basebackup \
  -d "$DATABASE_URL" \
  -D /backups/base_$(date +%F) \
  -Ft -z -P -X stream
```

## PITR Prerequisites
- `wal_level = replica`
- `archive_mode = on`
- `archive_command` configured and tested
- `restore_command` configured in restore environment

## Restore Procedure (Staging Drill)
1. Provision isolated PostgreSQL instance with same major version.
2. Restore base backup.
3. Configure WAL replay (`restore_command` + recovery target).
4. Start instance and replay to target timestamp.
5. Run validation queries:
```sql
select count(*) from tenants;
select count(*) from messages where created_at >= now() - interval '1 day';
select tenant_id, sum(billable_count) from usage_counters group by tenant_id;
```
6. Execute tenant smoke test in application.
7. Record:
  - restore start/end time
  - achieved RTO
  - data cutoff timestamp (achieved RPO)

## Post-Restore Checklist
- Rotate credentials used during restore.
- Confirm application connectivity and migration status.
- Confirm queue consumers are reattached safely.
- Store drill evidence and improvement actions.
