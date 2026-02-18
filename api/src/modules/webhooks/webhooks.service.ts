import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PostgresService } from '../../shared/database/postgres.service';

type MetaStatus = 'sent' | 'delivered' | 'read' | 'failed';

type ReconcileRow = {
  previous_status: string;
};

@Injectable()
export class WebhooksService {
  constructor(private readonly db: PostgresService) {}

  async verifySignature(rawBody: Buffer, signatureHeader?: string): Promise<boolean> {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(signatureHeader);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  async storeEvent(tenantId: string, payload: unknown, signatureOk: boolean): Promise<void> {
    await this.db.query(
      `insert into webhook_events (tenant_id, source, payload_jsonb, signature_ok, processed_at)
       values ($1, 'meta_whatsapp', $2::jsonb, $3, now())`,
      [tenantId, JSON.stringify(payload), signatureOk]
    );
  }

  async reconcileMessageStatuses(tenantId: string, payload: unknown): Promise<number> {
    const statuses = this.extractStatuses(payload);
    let updated = 0;

    for (const status of statuses) {
      const mappedStatus = this.mapMetaStatus(status.status);
      const errorCode = status.errorCode ?? null;

      const res = await this.db.query<ReconcileRow>(
        `with target as (
           select id, status as previous_status
           from campaign_messages
           where tenant_id = $3
             and meta_message_id = $4
           for update
         ),
         updated as (
           update campaign_messages cm
           set status = $1,
               error_code = $2
           from target t
           where cm.id = t.id
             and cm.status is distinct from $1
           returning t.previous_status
         )
         select previous_status from updated`,
        [mappedStatus, errorCode, tenantId, status.messageId]
      );

      const count = res.rowCount ?? 0;
      updated += count;

      if (count > 0) {
        await this.incrementUsageCounters(tenantId, res.rows.map((row) => row.previous_status), mappedStatus);
      }
    }

    return updated;
  }

  private async incrementUsageCounters(
    tenantId: string,
    previousStatuses: string[],
    newStatus: string
  ): Promise<void> {
    let sent = 0;
    let delivered = 0;
    let failed = 0;
    let billable = 0;

    for (const previous of previousStatuses) {
      if (newStatus === 'sent' && previous !== 'sent') {
        sent += 1;
      }

      if (newStatus === 'delivered' && previous !== 'delivered') {
        delivered += 1;
        billable += 1;
      }

      if (newStatus.startsWith('failed') && !previous.startsWith('failed')) {
        failed += 1;
      }
    }

    if (sent === 0 && delivered === 0 && failed === 0 && billable === 0) {
      return;
    }

    await this.db.query(
      `insert into usage_counters (tenant_id, period_day, sent_count, delivered_count, failed_count, billable_count)
       values ($1, current_date, $2, $3, $4, $5)
       on conflict (tenant_id, period_day)
       do update set
         sent_count = usage_counters.sent_count + excluded.sent_count,
         delivered_count = usage_counters.delivered_count + excluded.delivered_count,
         failed_count = usage_counters.failed_count + excluded.failed_count,
         billable_count = usage_counters.billable_count + excluded.billable_count`,
      [tenantId, sent, delivered, failed, billable]
    );
  }

  private extractStatuses(payload: unknown): Array<{ messageId: string; status: MetaStatus; errorCode?: string }> {
    const root = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              id?: string;
              status?: MetaStatus;
              errors?: Array<{ code?: number | string }>;
            }>;
          };
        }>;
      }>;
    };

    const results: Array<{ messageId: string; status: MetaStatus; errorCode?: string }> = [];

    for (const entry of root.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const item of change.value?.statuses ?? []) {
          if (!item.id || !item.status) {
            continue;
          }

          const errorCode = item.errors?.[0]?.code;
          results.push({
            messageId: item.id,
            status: item.status,
            errorCode: errorCode !== undefined ? String(errorCode) : undefined
          });
        }
      }
    }

    return results;
  }

  private mapMetaStatus(status: MetaStatus): string {
    switch (status) {
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
        return 'failed_permanent';
      default:
        return 'failed_permanent';
    }
  }
}
