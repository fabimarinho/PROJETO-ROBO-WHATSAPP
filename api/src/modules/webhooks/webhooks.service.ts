import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PostgresService } from '../../shared/database/postgres.service';

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
}
