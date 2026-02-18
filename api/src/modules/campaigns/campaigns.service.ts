import { Injectable, NotFoundException } from '@nestjs/common';
import { PostgresService } from '../../shared/database/postgres.service';
import { RabbitPublisherService } from '../../shared/messaging/rabbit-publisher.service';
import { Campaign, CampaignMetrics } from './campaign.model';

type DbCampaign = {
  id: string;
  tenant_id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed';
  created_at: string;
  template_name: string;
};

type DbMetrics = {
  queued: string;
  sent: string;
  delivered: string;
  failed: string;
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly db: PostgresService,
    private readonly publisher: RabbitPublisherService
  ) {}

  async create(input: {
    tenantId: string;
    name: string;
    templateName: string;
    createdBy: string;
  }): Promise<Campaign> {
    const templateRes = await this.db.query<{ id: string }>(
      `insert into templates (tenant_id, name, language_code, category, status)
       values ($1, $2, 'pt_BR', 'MARKETING', 'approved')
       on conflict (tenant_id, name, language_code)
       do update set category = excluded.category
       returning id`,
      [input.tenantId, input.templateName]
    );

    const templateId = templateRes.rows[0].id;

    const campaignRes = await this.db.query<DbCampaign>(
      `insert into campaigns (tenant_id, name, template_id, status, created_by)
       values ($1, $2, $3, 'draft', $4)
       returning id, tenant_id, name, status, created_at,
       (select name from templates where id = $3) as template_name`,
      [input.tenantId, input.name, templateId, input.createdBy]
    );

    return this.toCampaign(campaignRes.rows[0]);
  }

  async launch(tenantId: string, campaignId: string): Promise<Campaign> {
    const exists = await this.getOrThrow(tenantId, campaignId);

    await this.db.query(
      `update campaigns
       set status = 'running'
       where id = $1 and tenant_id = $2`,
      [campaignId, tenantId]
    );

    await this.publisher.publish(process.env.RABBITMQ_CAMPAIGN_QUEUE ?? 'campaign.launch', {
      tenantId,
      campaignId,
      requestedAt: new Date().toISOString(),
      requestId: `${tenantId}:${campaignId}`
    });

    return {
      ...exists,
      status: 'running'
    };
  }

  async getMetrics(tenantId: string, campaignId: string): Promise<CampaignMetrics> {
    await this.getOrThrow(tenantId, campaignId);

    const metricsRes = await this.db.query<DbMetrics>(
      `select
        count(*) filter (where status = 'queued')::text as queued,
        count(*) filter (where status in ('sent','accepted_meta'))::text as sent,
        count(*) filter (where status = 'delivered')::text as delivered,
        count(*) filter (where status like 'failed%')::text as failed
      from campaign_messages
      where tenant_id = $1 and campaign_id = $2`,
      [tenantId, campaignId]
    );

    const row = metricsRes.rows[0] ?? { queued: '0', sent: '0', delivered: '0', failed: '0' };

    return {
      queued: Number(row.queued),
      sent: Number(row.sent),
      delivered: Number(row.delivered),
      failed: Number(row.failed)
    };
  }

  async listByTenant(tenantId: string): Promise<Campaign[]> {
    const res = await this.db.query<DbCampaign>(
      `select c.id, c.tenant_id, c.name, c.status, c.created_at, t.name as template_name
       from campaigns c
       inner join templates t on t.id = c.template_id
       where c.tenant_id = $1
       order by c.created_at desc`,
      [tenantId]
    );

    return res.rows.map((item) => this.toCampaign(item));
  }

  private async getOrThrow(tenantId: string, campaignId: string): Promise<Campaign> {
    const res = await this.db.query<DbCampaign>(
      `select c.id, c.tenant_id, c.name, c.status, c.created_at, t.name as template_name
       from campaigns c
       inner join templates t on t.id = c.template_id
       where c.id = $1 and c.tenant_id = $2
       limit 1`,
      [campaignId, tenantId]
    );

    const campaign = res.rows[0];
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return this.toCampaign(campaign);
  }

  private toCampaign(row: DbCampaign): Campaign {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      templateName: row.template_name,
      status: row.status,
      createdAt: row.created_at
    };
  }
}
