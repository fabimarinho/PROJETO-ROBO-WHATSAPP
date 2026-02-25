import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    this.pool = new Pool(
      connectionString
        ? { connectionString }
        : {
            host: process.env.DB_HOST ?? 'localhost',
            port: Number(process.env.DB_PORT ?? 5432),
            database: process.env.DB_NAME ?? 'robo_whatsapp',
            user: process.env.DB_USER ?? 'app',
            password: process.env.DB_PASSWORD ?? 'app123'
          }
    );
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = []
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async queryForTenant<T extends QueryResultRow = QueryResultRow>(
    tenantId: string,
    text: string,
    values: unknown[] = []
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');
      await client.query("set local app.tenant_id = $1", [tenantId]);
      const result = await client.query<T>(text, values);
      await client.query('commit');
      return result;
    } catch (error) {
      try {
        await client.query('rollback');
      } catch {
        // no-op
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
