import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../../shared/database/postgres.service';
import { Contact } from './contact.model';

type DbContact = {
  id: string;
  tenant_id: string;
  phone_e164: string;
  wa_id: string | null;
  consent_status: string;
  created_at: string;
};

@Injectable()
export class ContactsService {
  constructor(private readonly db: PostgresService) {}

  async create(input: {
    tenantId: string;
    phoneE164: string;
    waId?: string;
    consentStatus?: string;
  }): Promise<Contact> {
    const res = await this.db.query<DbContact>(
      `insert into contacts (id, tenant_id, phone_e164, wa_id, consent_status)
       values ($1, $2, $3, $4, $5)
       on conflict (tenant_id, phone_e164)
       do update set wa_id = excluded.wa_id, consent_status = excluded.consent_status
       returning id, tenant_id, phone_e164, wa_id, consent_status, created_at`,
      [
        randomUUID(),
        input.tenantId,
        input.phoneE164,
        input.waId ?? null,
        input.consentStatus ?? 'opted_in'
      ]
    );

    return this.toContact(res.rows[0]);
  }

  async listByTenant(tenantId: string): Promise<Contact[]> {
    const res = await this.db.query<DbContact>(
      `select id, tenant_id, phone_e164, wa_id, consent_status, created_at
       from contacts
       where tenant_id = $1
       order by created_at desc`,
      [tenantId]
    );

    return res.rows.map((row) => this.toContact(row));
  }

  async importCsv(input: {
    tenantId: string;
    csvContent: string;
  }): Promise<{ total: number; imported: number; invalid: number }> {
    const lines = input.csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let total = 0;
    let imported = 0;
    let invalid = 0;

    for (const line of lines) {
      total += 1;
      const [phoneRaw, waIdRaw, consentRaw] = line.split(',').map((value) => value?.trim());
      const phone = this.normalizePhone(phoneRaw);

      if (!phone) {
        invalid += 1;
        continue;
      }

      await this.create({
        tenantId: input.tenantId,
        phoneE164: phone,
        waId: waIdRaw || undefined,
        consentStatus: consentRaw || 'opted_in'
      });
      imported += 1;
    }

    return { total, imported, invalid };
  }

  private toContact(row: DbContact): Contact {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      phoneE164: row.phone_e164,
      waId: row.wa_id,
      consentStatus: row.consent_status,
      createdAt: row.created_at
    };
  }

  private normalizePhone(value?: string): string | null {
    if (!value) {
      return null;
    }

    const cleaned = value.replace(/[^\d+]/g, '');
    if (cleaned.length < 8) {
      return null;
    }

    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }
}
