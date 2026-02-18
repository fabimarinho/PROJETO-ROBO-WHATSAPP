import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Pool } from 'pg';

describe('API integration: database and migrations', () => {
  it('connects to postgres and finds migrated tables', async () => {
    const pool = new Pool(
      process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: process.env.DB_HOST ?? 'localhost',
            port: Number(process.env.DB_PORT ?? 5432),
            database: process.env.DB_NAME ?? 'robo_whatsapp',
            user: process.env.DB_USER ?? 'app',
            password: process.env.DB_PASSWORD ?? 'app123'
          }
    );

    try {
      const ping = await pool.query<{ ok: number }>('select 1 as ok');
      assert.equal(ping.rows[0]?.ok, 1);

      const tables = await pool.query<{ table_name: string }>(
        `select table_name
         from information_schema.tables
         where table_schema = 'public'
           and table_name in ('tenants', 'campaigns', 'campaign_messages', 'schema_migrations')`
      );

      const found = new Set(tables.rows.map((row) => row.table_name));
      assert.equal(found.has('tenants'), true);
      assert.equal(found.has('campaigns'), true);
      assert.equal(found.has('campaign_messages'), true);
      assert.equal(found.has('schema_migrations'), true);
    } finally {
      await pool.end();
    }
  });
});
