import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

async function main(): Promise<void> {
  const mode = process.argv.includes('--status') ? 'status' : 'apply';
  const migrationsDir = resolve(process.cwd(), '..', 'sql', 'migrations');

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

  await pool.query(`
    create table if not exists schema_migrations (
      version varchar(120) primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const appliedRes = await pool.query<{ version: string }>('select version from schema_migrations');
  const applied = new Set(appliedRes.rows.map((row) => row.version));

  if (mode === 'status') {
    for (const file of files) {
      const status = applied.has(file) ? 'APPLIED' : 'PENDING';
      console.log(`${status} ${file}`);
    }
    await pool.end();
    return;
  }

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
    const client = await pool.connect();

    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (version) values ($1)', [file]);
      await client.query('commit');
      console.log(`APPLIED ${file}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

void main();
