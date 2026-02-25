import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PostgresService } from '../../shared/database/postgres.service';

type PhraseBank = {
  openers?: string[];
  bodies?: string[];
  closings?: string[];
};

type DbHumanizationConfig = {
  campaign_id: string;
  profile_id: string;
  rotation_strategy: 'round_robin' | 'random';
  is_active: boolean;
  base_template_text: string;
  phrase_bank_jsonb: PhraseBank;
  syntactic_variation_level: number;
  min_delay_ms: number;
  max_delay_ms: number;
  last_variant_index: number;
  last_variant_hash: string | null;
};

type DbContact = {
  id: string;
  attributes_jsonb: Record<string, unknown> | null;
};

type PreviewVariant = {
  text: string;
  hash: string;
  delayMs: number;
};

@Injectable()
export class MessageVariationService {
  constructor(private readonly db: PostgresService) {}

  async configureCampaign(tenantId: string, input: {
    campaignId: string;
    name?: string;
    enabled: boolean;
    rotationStrategy: 'round_robin' | 'random';
    baseTemplateText: string;
    phraseBank: PhraseBank;
    syntacticVariationLevel: number;
    minDelayMs: number;
    maxDelayMs: number;
  }): Promise<void> {
    const campaignRes = await this.db.queryForTenant<{ id: string }>(
      tenantId,
      `select id
       from campaigns
       where id = $1 and tenant_id = $2 and deleted_at is null
       limit 1`,
      [input.campaignId, tenantId]
    );
    if (!campaignRes.rows[0]) {
      throw new NotFoundException('Campaign not found');
    }

    const profileRes = await this.db.queryForTenant<{ id: string }>(
      tenantId,
      `insert into message_variation_profiles (
         tenant_id, name, base_template_text, phrase_bank_jsonb,
         syntactic_variation_level, min_delay_ms, max_delay_ms
       )
       values ($1, $2, $3, $4::jsonb, $5, $6, $7)
       on conflict (tenant_id, name)
       do update set
         base_template_text = excluded.base_template_text,
         phrase_bank_jsonb = excluded.phrase_bank_jsonb,
         syntactic_variation_level = excluded.syntactic_variation_level,
         min_delay_ms = excluded.min_delay_ms,
         max_delay_ms = excluded.max_delay_ms,
         updated_at = now()
       returning id`,
      [
        tenantId,
        input.name ?? `campaign:${input.campaignId}`,
        input.baseTemplateText,
        JSON.stringify(input.phraseBank ?? {}),
        Math.min(Math.max(input.syntacticVariationLevel, 0), 3),
        Math.max(input.minDelayMs, 0),
        Math.max(input.maxDelayMs, input.minDelayMs)
      ]
    );
    const profileId = profileRes.rows[0].id;

    await this.db.queryForTenant(
      tenantId,
      `insert into campaign_message_humanization_settings (
         tenant_id, campaign_id, profile_id, rotation_strategy, is_active
       )
       values ($1, $2, $3, $4, $5)
       on conflict (campaign_id)
       do update set
         profile_id = excluded.profile_id,
         rotation_strategy = excluded.rotation_strategy,
         is_active = excluded.is_active,
         updated_at = now()`,
      [tenantId, input.campaignId, profileId, input.rotationStrategy, input.enabled]
    );
  }

  async getCampaignConfiguration(tenantId: string, campaignId: string): Promise<DbHumanizationConfig | null> {
    const res = await this.db.queryForTenant<DbHumanizationConfig>(
      tenantId,
      `select s.campaign_id, s.profile_id, s.rotation_strategy, s.is_active,
              p.base_template_text, p.phrase_bank_jsonb, p.syntactic_variation_level,
              p.min_delay_ms, p.max_delay_ms, s.last_variant_index, s.last_variant_hash
       from campaign_message_humanization_settings s
       inner join message_variation_profiles p on p.id = s.profile_id and p.tenant_id = s.tenant_id
       where s.tenant_id = $1 and s.campaign_id = $2
       limit 1`,
      [tenantId, campaignId]
    );
    return res.rows[0] ?? null;
  }

  async previewCampaignVariants(
    tenantId: string,
    campaignId: string,
    contactId: string,
    count = 5
  ): Promise<PreviewVariant[]> {
    const config = await this.getCampaignConfiguration(tenantId, campaignId);
    if (!config || !config.is_active) {
      return [];
    }

    const contactRes = await this.db.queryForTenant<DbContact>(
      tenantId,
      `select id, attributes_jsonb
       from contacts
       where tenant_id = $1 and id = $2 and deleted_at is null
       limit 1`,
      [tenantId, contactId]
    );
    const contact = contactRes.rows[0];
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const attrs = contact.attributes_jsonb ?? {};
    const vars = {
      nome: this.extractString(attrs, ['nome', 'name']) ?? 'cliente',
      cidade: this.extractString(attrs, ['cidade', 'city']) ?? 'sua cidade'
    };

    const previews: PreviewVariant[] = [];
    let index = config.last_variant_index;
    let lastHash = config.last_variant_hash;
    const safeCount = Math.min(Math.max(count, 1), 20);

    for (let i = 0; i < safeCount; i++) {
      const variant = this.composeVariant({
        rotationStrategy: config.rotation_strategy,
        index,
        lastHash,
        baseTemplateText: config.base_template_text,
        phraseBank: config.phrase_bank_jsonb ?? {},
        syntacticVariationLevel: config.syntactic_variation_level,
        minDelayMs: config.min_delay_ms,
        maxDelayMs: config.max_delay_ms,
        vars
      });
      previews.push(variant);
      index = variant.nextIndex;
      lastHash = variant.hash;
    }

    return previews.map((item) => ({
      text: item.text,
      hash: item.hash,
      delayMs: item.delayMs
    }));
  }

  private composeVariant(input: {
    rotationStrategy: 'round_robin' | 'random';
    index: number;
    lastHash: string | null;
    baseTemplateText: string;
    phraseBank: PhraseBank;
    syntacticVariationLevel: number;
    minDelayMs: number;
    maxDelayMs: number;
    vars: { nome: string; cidade: string };
  }): { text: string; hash: string; delayMs: number; nextIndex: number } {
    const openers = input.phraseBank.openers?.length ? input.phraseBank.openers : ['Oi {{nome}}'];
    const bodies = input.phraseBank.bodies?.length
      ? input.phraseBank.bodies
      : [input.baseTemplateText];
    const closings = input.phraseBank.closings?.length
      ? input.phraseBank.closings
      : ['Se fizer sentido, eu te explico em 1 min.'];

    let nextIndex = input.index;
    if (input.rotationStrategy === 'round_robin') {
      nextIndex = input.index + 1;
    } else {
      nextIndex = Math.floor(Math.random() * 10_000);
    }

    const opener = openers[Math.abs(nextIndex) % openers.length];
    const body = bodies[Math.abs(nextIndex + 1) % bodies.length];
    const closing = closings[Math.abs(nextIndex + 2) % closings.length];

    let text = [opener, body, closing].join(' ').replace(/\s+/g, ' ').trim();
    text = this.renderVariables(text, input.vars);
    text = this.applySyntacticVariation(text, input.syntacticVariationLevel, nextIndex);

    let hash = this.hashText(text);
    if (input.lastHash && hash === input.lastHash) {
      text = text.endsWith('.') ? `${text.slice(0, -1)}!` : `${text}.`;
      hash = this.hashText(text);
    }

    return {
      text,
      hash,
      delayMs: this.randomDelay(input.minDelayMs, input.maxDelayMs),
      nextIndex
    };
  }

  private renderVariables(text: string, vars: { nome: string; cidade: string }): string {
    return text
      .replace(/\{\{\s*nome\s*\}\}/gi, vars.nome)
      .replace(/\{\{\s*cidade\s*\}\}/gi, vars.cidade);
  }

  private applySyntacticVariation(text: string, level: number, seed: number): string {
    if (level <= 0) {
      return text;
    }

    const alternatives = [
      [' tudo bem', ' tudo certo'],
      [' posso', ' consigo'],
      [' te mostrar', ' te explicar']
    ] as const;

    let output = text;
    const limit = Math.min(level, alternatives.length);
    for (let i = 0; i < limit; i++) {
      const [from, to] = alternatives[(seed + i) % alternatives.length];
      if (output.toLowerCase().includes(from.trim())) {
        output = output.replace(new RegExp(from, 'i'), to);
      }
    }

    return output;
  }

  private randomDelay(minDelayMs: number, maxDelayMs: number): number {
    const min = Math.max(0, minDelayMs);
    const max = Math.max(min, maxDelayMs);
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 24);
  }

  private extractString(obj: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return null;
  }
}
