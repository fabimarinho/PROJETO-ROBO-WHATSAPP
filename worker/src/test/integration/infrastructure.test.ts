import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { connect } from 'amqplib';
import Redis from 'ioredis';
import { Pool } from 'pg';

describe('Worker integration: infrastructure dependencies', () => {
  it('connects to postgres, rabbitmq and redis', async () => {
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

    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    const rabbitConnection = await connect(process.env.RABBITMQ_URL ?? 'amqp://localhost:5672');
    const rabbitChannel = await rabbitConnection.createChannel();

    try {
      const pg = await pool.query<{ ok: number }>('select 1 as ok');
      assert.equal(pg.rows[0]?.ok, 1);

      const pong = await redis.ping();
      assert.equal(pong, 'PONG');

      const queue = await rabbitChannel.assertQueue('ci.integration.check', { durable: false });
      assert.equal(queue.queue.length > 0, true);
    } finally {
      await rabbitChannel.close();
      await rabbitConnection.close();
      await redis.quit();
      await pool.end();
    }
  });
});
