import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CampaignsService } from '../modules/campaigns/campaigns.service';

class FakeDb {
  public calls: string[] = [];

  async query(text: string, values: unknown[] = []): Promise<{ rowCount: number; rows: Array<Record<string, string>> }> {
    this.calls.push(text);

    if (text.includes('where c.id = $1 and c.tenant_id = $2 and c.deleted_at is null')) {
      return {
        rowCount: 1,
        rows: [
          {
            id: String(values[0]),
            tenant_id: String(values[1]),
            name: 'Campaign A',
            status: 'running',
            created_at: new Date().toISOString(),
            template_name: 'tpl'
          }
        ]
      };
    }

    if (text.includes('from messages')) {
      return {
        rowCount: 1,
        rows: [{ queued: '2', sent: '3', delivered: '1', failed: '0' }]
      };
    }

    if (text.includes('from campaign_messages')) {
      return {
        rowCount: 1,
        rows: [{ queued: '9', sent: '9', delivered: '9', failed: '9' }]
      };
    }

    return { rowCount: 0, rows: [] };
  }

  queryForTenant(
    _tenantId: string,
    text: string,
    values: unknown[] = []
  ): Promise<{ rowCount: number; rows: Array<Record<string, string>> }> {
    return this.query(text, values);
  }
}

class FakeQueue {
  async enqueueCampaignLaunch(): Promise<void> {
    return;
  }
}

class FakeVariationService {
  async configureCampaign(): Promise<void> {
    return;
  }

  async getCampaignConfiguration(): Promise<null> {
    return null;
  }

  async previewCampaignVariants(): Promise<Array<{ text: string; hash: string; delayMs: number }>> {
    return [];
  }
}

describe('CampaignsService', () => {
  it('prefers metrics from messages table before legacy campaign_messages', async () => {
    const db = new FakeDb();
    const service = new CampaignsService(
      db as never,
      new FakeQueue() as never,
      new FakeVariationService() as never
    );

    const metrics = await service.getMetrics('tenant-1', 'campaign-1');

    assert.deepEqual(metrics, { queued: 2, sent: 3, delivered: 1, failed: 0 });
    assert.equal(db.calls.some((call) => call.includes('from campaign_messages')), false);
  });
});
