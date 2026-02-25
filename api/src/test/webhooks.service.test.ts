import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHmac } from 'node:crypto';
import { WebhooksService } from '../modules/webhooks/webhooks.service';

class FakeDb {
  public calls: Array<{ text: string; values: unknown[] }> = [];

  async query(
    text: string,
    values: unknown[] = []
  ): Promise<{ rowCount: number; rows: Array<{ id?: string; previous_status: string }> }> {
    this.calls.push({ text, values });

    if (text.includes('from campaign_messages')) {
      return { rowCount: 0, rows: [] };
    }

    if (text.includes('from messages')) {
      return { rowCount: 1, rows: [{ id: 'message-1', previous_status: 'sent' }] };
    }

    if (text.includes('select previous_status from updated')) {
      return { rowCount: 1, rows: [{ previous_status: 'sent' }] };
    }

    return { rowCount: 1, rows: [] };
  }

  queryForTenant(
    _tenantId: string,
    text: string,
    values: unknown[] = []
  ): Promise<{ rowCount: number; rows: Array<{ id?: string; previous_status: string }> }> {
    return this.query(text, values);
  }
}

describe('WebhooksService', () => {
  it('validates HMAC signature', async () => {
    process.env.META_APP_SECRET = 'secret-key';
    const body = Buffer.from('{"ok":true}');
    const signature = `sha256=${createHmac('sha256', 'secret-key').update(body).digest('hex')}`;

    const service = new WebhooksService(new FakeDb() as never);
    const valid = await service.verifySignature(body, signature);

    assert.equal(valid, true);
  });

  it('reconciles statuses from messages table and writes billing counters idempotently', async () => {
    const db = new FakeDb();
    const service = new WebhooksService(db as never);

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: 'wamid.123', status: 'delivered' }]
              }
            }
          ]
        }
      ]
    };

    const updated = await service.reconcileMessageStatuses('tenant-1', payload);

    assert.equal(updated, 1);
    assert.equal(
      db.calls.some((call) => call.text.includes('insert into usage_counters')),
      true
    );
  });
});
