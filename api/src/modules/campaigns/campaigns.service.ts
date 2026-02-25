import { Injectable, NotFoundException } from '@nestjs/common';
import { PostgresService } from '../../shared/database/postgres.service';
import { QueueService } from '../queue/queue.service';
import { Campaign, CampaignLog, CampaignMetrics } from './campaign.model';

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

type DbCampaignLog = {
  message_id: string | null;
  event_type: string;
  event_source: string;
  event_at: string;
  payload_jsonb: unknown;
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly db: PostgresService,
    private readonly queue: QueueService
  ) {}

  async create(input: {
    tenantId: string;
    name: string;
    templateName: string;
    createdBy: string;
  }): Promise<Campaign> {
    const templateRes = await this.db.queryForTenant<{ id: string }>(
      input.tenantId,
      `insert into templates (tenant_id, name, language_code, category, status)
       values ($1, $2, 'pt_BR', 'MARKETING', 'approved')
       on conflict (tenant_id, name, language_code)
       do update set category = excluded.category
       returning id`,
      [input.tenantId, input.templateName]
    );

    const templateId = templateRes.rows[0].id;

    const campaignRes = await this.db.queryForTenant<DbCampaign>(
      input.tenantId,
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

    await this.db.queryForTenant(
      tenantId,
      `update campaigns
       set status = 'running'
       where id = $1 and tenant_id = $2`,
      [campaignId, tenantId]
    );

    await this.queue.enqueueCampaignLaunch({
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

    const metricsFromMessages = await this.db.queryForTenant<DbMetrics>(
      tenantId,
      `select
        count(*) filter (where status = 'queued')::text as queued,
        count(*) filter (where status in ('sent','accepted_meta'))::text as sent,
        count(*) filter (where status = 'delivered')::text as delivered,
        count(*) filter (where status like 'failed%')::text as failed
      from messages
      where tenant_id = $1 and campaign_id = $2 and deleted_at is null`,
      [tenantId, campaignId]
    );

    const rowFromMessages = metricsFromMessages.rows[0] ?? {
      queued: '0',
      sent: '0',
      delivered: '0',
      failed: '0'
    };
    const totalFromMessages =
      Number(rowFromMessages.queued) +
      Number(rowFromMessages.sent) +
      Number(rowFromMessages.delivered) +
      Number(rowFromMessages.failed);

    if (totalFromMessages > 0) {
      return {
        queued: Number(rowFromMessages.queued),
        sent: Number(rowFromMessages.sent),
        delivered: Number(rowFromMessages.delivered),
        failed: Number(rowFromMessages.failed)
      };
    }

    const metricsFromLegacy = await this.db.queryForTenant<DbMetrics>(
      tenantId,
      `select
        count(*) filter (where status = 'queued')::text as queued,
        count(*) filter (where status in ('sent','accepted_meta'))::text as sent,
        count(*) filter (where status = 'delivered')::text as delivered,
        count(*) filter (where status like 'failed%')::text as failed
      from campaign_messages
      where tenant_id = $1 and campaign_id = $2`,
      [tenantId, campaignId]
    );

    const row = metricsFromLegacy.rows[0] ?? { queued: '0', sent: '0', delivered: '0', failed: '0' };

    return {
      queued: Number(row.queued),
      sent: Number(row.sent),
      delivered: Number(row.delivered),
      failed: Number(row.failed)
    };
  }

  async listByTenant(tenantId: string): Promise<Campaign[]> {
    const res = await this.db.queryForTenant<DbCampaign>(
      tenantId,
      `select c.id, c.tenant_id, c.name, c.status, c.created_at, t.name as template_name
       from campaigns c
       inner join templates t on t.id = c.template_id
       where c.tenant_id = $1
         and c.deleted_at is null
       order by c.created_at desc`,
      [tenantId]
    );

    return res.rows.map((item) => this.toCampaign(item));
  }

  async getLogs(tenantId: string, campaignId: string, limit = 100): Promise<CampaignLog[]> {
    await this.getOrThrow(tenantId, campaignId);

    const safeLimit = Math.min(Math.max(limit, 1), 500);

    const logsFromMessageModel = await this.db.queryForTenant<DbCampaignLog>(
      tenantId,
      `select m.id as message_id,
              ml.event_type,
              ml.event_source,
              ml.event_at,
              ml.payload_jsonb
       from message_logs ml
       inner join messages m on m.id = ml.message_id and m.tenant_id = ml.tenant_id
       where ml.tenant_id = $1
         and m.campaign_id = $2
       order by ml.event_at desc
       limit $3`,
      [tenantId, campaignId, safeLimit]
    );

    if ((logsFromMessageModel.rowCount ?? 0) > 0) {
      return logsFromMessageModel.rows.map((row) => ({
        messageId: row.message_id,
        eventType: row.event_type,
        eventSource: row.event_source,
        eventAt: row.event_at,
        payload: row.payload_jsonb
      }));
    }

    const logsFromLegacy = await this.db.queryForTenant<DbCampaignLog>(
      tenantId,
      `select null::uuid as message_id,
              'legacy_webhook_event'::varchar as event_type,
              'meta_webhook'::varchar as event_source,
              we.created_at as event_at,
              we.payload_jsonb
       from webhook_events we
       where we.tenant_id = $1
       order by we.created_at desc
       limit $2`,
      [tenantId, safeLimit]
    );

    return logsFromLegacy.rows.map((row) => ({
      messageId: row.message_id,
      eventType: row.event_type,
      eventSource: row.event_source,
      eventAt: row.event_at,
      payload: row.payload_jsonb
    }));
  }

  private async getOrThrow(tenantId: string, campaignId: string): Promise<Campaign> {
    const res = await this.db.queryForTenant<DbCampaign>(
      tenantId,
      `select c.id, c.tenant_id, c.name, c.status, c.created_at, t.name as template_name
       from campaigns c
       inner join templates t on t.id = c.template_id
       where c.id = $1 and c.tenant_id = $2 and c.deleted_at is null
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
