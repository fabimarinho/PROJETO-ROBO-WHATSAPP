import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../../shared/database/postgres.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class MessagingService {
  constructor(
    private readonly db: PostgresService,
    private readonly queue: QueueService
  ) {}

  async enqueueTemplateMessage(input: {
    tenantId: string;
    campaignId: string;
    contactId: string;
    templateName: string;
    languageCode?: string;
  }): Promise<{ messageId: string; queued: true }> {
    const campaignExists = await this.db.queryForTenant<{ id: string }>(
      input.tenantId,
      'select id from campaigns where id = $1 and tenant_id = $2 and deleted_at is null limit 1',
      [input.campaignId, input.tenantId]
    );
    if (!campaignExists.rows[0]) {
      throw new NotFoundException('Campaign not found');
    }

    const idempotencyKey = `${input.campaignId}:${input.contactId}:${randomUUID()}`;
    const messageRes = await this.db.queryForTenant<{ id: string }>(
      input.tenantId,
      `insert into messages (
         tenant_id, campaign_id, contact_id, direction, provider, idempotency_key,
         status, template_name, template_language_code, payload_jsonb
       ) values ($1, $2, $3, 'outbound', 'meta', $4, 'queued', $5, $6, '{}'::jsonb)
       returning id`,
      [
        input.tenantId,
        input.campaignId,
        input.contactId,
        idempotencyKey,
        input.templateName,
        input.languageCode ?? 'pt_BR'
      ]
    );

    const messageId = messageRes.rows[0].id;
    await this.queue.enqueueMessageSend({
      tenantId: input.tenantId,
      campaignId: input.campaignId,
      messageId
    });

    return { messageId, queued: true };
  }
}
