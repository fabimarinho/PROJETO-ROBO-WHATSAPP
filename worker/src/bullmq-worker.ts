import { Job, Queue, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { DbClient } from './infra/db-client';
import { PlanRateLimiter } from './infra/plan-rate-limiter';

type CampaignLaunchJob = {
  tenantId: string;
  campaignId: string;
  requestedAt: string;
  requestId: string;
};

type MessageSendJob = {
  tenantId: string;
  campaignId: string;
  messageId: string;
};

type MessageTarget = {
  id: string;
  contact_id: string;
  idempotency_key: string;
  phone_e164: string;
  wa_id: string | null;
  template_name: string;
  template_language_code: string;
  plan_code: string;
};

const campaignQueueName = process.env.BULLMQ_CAMPAIGN_QUEUE ?? 'campaign.launch';
const messageQueueName = process.env.BULLMQ_MESSAGE_QUEUE ?? 'message.send';

const redisConnection = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD
};

const concurrency = Number(process.env.BULLMQ_WORKER_CONCURRENCY ?? 20);

async function processCampaignLaunch(db: DbClient, messageQueue: Queue<MessageSendJob>, payload: CampaignLaunchJob): Promise<void> {
  const campaignRes = await db.queryForTenant<{ id: string; template_name: string; language_code: string }>(
    payload.tenantId,
    `select cp.id, t.name as template_name, t.language_code
     from campaigns cp
     inner join templates t on t.id = cp.template_id
     where cp.id = $1 and cp.tenant_id = $2
     limit 1`,
    [payload.campaignId, payload.tenantId]
  );
  if (!campaignRes.rows[0]) {
    throw new Error('campaign_not_found');
  }

  const contactsRes = await db.queryForTenant<{ id: string }>(
    payload.tenantId,
    `select id
     from contacts
     where tenant_id = $1
       and consent_status in ('opted_in', 'unknown')
       and deleted_at is null`,
    [payload.tenantId]
  );

  for (const contact of contactsRes.rows) {
    const idempotencyKey = `${payload.campaignId}:${contact.id}`;
    await db.queryForTenant(
      payload.tenantId,
      `insert into campaign_contacts (tenant_id, campaign_id, contact_id, status)
       values ($1, $2, $3, 'queued')
       on conflict (tenant_id, campaign_id, contact_id)
       do update set status = 'queued', updated_at = now()`,
      [payload.tenantId, payload.campaignId, contact.id]
    );

    const messageRes = await db.queryForTenant<{ id: string }>(
      payload.tenantId,
      `insert into messages (
         tenant_id, campaign_id, contact_id, direction, provider, idempotency_key,
         status, template_name, template_language_code, payload_jsonb
       ) values ($1, $2, $3, 'outbound', 'meta', $4, 'queued', $5, $6, '{}'::jsonb)
       on conflict (tenant_id, idempotency_key)
       do update set status = 'queued', updated_at = now()
       returning id`,
      [payload.tenantId, payload.campaignId, contact.id, idempotencyKey, campaignRes.rows[0].template_name, campaignRes.rows[0].language_code]
    );

    await messageQueue.add(
      `send:${payload.tenantId}:${messageRes.rows[0].id}`,
      {
        tenantId: payload.tenantId,
        campaignId: payload.campaignId,
        messageId: messageRes.rows[0].id
      },
      {
        attempts: Number(process.env.BULLMQ_MAX_ATTEMPTS ?? 5),
        backoff: { type: 'exponential', delay: Number(process.env.BULLMQ_RETRY_DELAY_MS ?? 3000) },
        removeOnComplete: 1000,
        removeOnFail: false
      }
    );
  }
}

async function processMessageSend(db: DbClient, limiter: PlanRateLimiter, payload: MessageSendJob): Promise<void> {
  const targetRes = await db.queryForTenant<MessageTarget>(
    payload.tenantId,
    `select m.id, m.contact_id, m.idempotency_key, c.phone_e164, c.wa_id,
            m.template_name, m.template_language_code, t.plan_code
     from messages m
     inner join contacts c on c.id = m.contact_id and c.tenant_id = m.tenant_id
     inner join tenants t on t.id = m.tenant_id
     where m.id = $1 and m.tenant_id = $2 and m.campaign_id = $3
     limit 1`,
    [payload.messageId, payload.tenantId, payload.campaignId]
  );

  const target = targetRes.rows[0];
  if (!target) {
    throw new Error('message_target_not_found');
  }

  await limiter.assertAllowed(payload.tenantId, target.plan_code);

  const recipient = target.wa_id ?? target.phone_e164;
  const sendResult = await sendWhatsappTemplateMessage(
    recipient,
    target.template_name,
    target.template_language_code ?? 'pt_BR'
  );

  if (!sendResult.ok) {
    await db.queryForTenant(
      payload.tenantId,
      `update messages
       set status = 'failed_retryable',
           error_code = $1,
           updated_at = now()
       where id = $2 and tenant_id = $3`,
      [sendResult.errorCode, payload.messageId, payload.tenantId]
    );
    throw new Error(sendResult.errorCode);
  }

  await db.queryForTenant(
    payload.tenantId,
    `update messages
     set status = 'accepted_meta',
         provider_message_id = $1,
         error_code = null,
         updated_at = now()
     where id = $2 and tenant_id = $3`,
    [sendResult.providerMessageId, payload.messageId, payload.tenantId]
  );

  await db.queryForTenant(
    payload.tenantId,
    `insert into message_logs (tenant_id, message_id, event_type, event_source, payload_jsonb)
     values ($1, $2, 'accepted_meta', 'worker', $3::jsonb)`,
    [payload.tenantId, payload.messageId, JSON.stringify({ providerMessageId: sendResult.providerMessageId })]
  );
}

async function sendWhatsappTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string
): Promise<{ ok: true; providerMessageId: string } | { ok: false; errorCode: string }> {
  const token = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const graphVersion = process.env.META_GRAPH_VERSION ?? 'v20.0';

  if (!token || !phoneNumberId) {
    return { ok: true, providerMessageId: `mock-${randomUUID()}` };
  }

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode }
      }
    })
  });

  const payload = (await response.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { code?: number | string };
  };

  if (!response.ok) {
    return {
      ok: false,
      errorCode: payload.error?.code ? String(payload.error.code) : 'meta_request_failed'
    };
  }

  const id = payload.messages?.[0]?.id;
  if (!id) {
    return { ok: false, errorCode: 'meta_missing_message_id' };
  }

  return { ok: true, providerMessageId: id };
}

async function start(): Promise<void> {
  const db = new DbClient();
  const limiter = new PlanRateLimiter();
  const dlq = new Queue('message.send.dlq', { connection: redisConnection });
  const messageQueue = new Queue<MessageSendJob>(messageQueueName, { connection: redisConnection });

  const campaignWorker = new Worker<CampaignLaunchJob>(
    campaignQueueName,
    async (job: Job<CampaignLaunchJob>) => processCampaignLaunch(db, messageQueue, job.data),
    { connection: redisConnection, concurrency }
  );

  const messageWorker = new Worker<MessageSendJob>(
    messageQueueName,
    async (job: Job<MessageSendJob>) => processMessageSend(db, limiter, job.data),
    { connection: redisConnection, concurrency }
  );

  messageWorker.on('failed', async (job, err) => {
    if (!job) {
      return;
    }
    if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)) {
      await dlq.add(`dlq:${job.id}`, {
        ...job.data,
        reason: err.message,
        failedAt: new Date().toISOString()
      });
    }
  });

  const shutdown = async (): Promise<void> => {
    await Promise.all([campaignWorker.close(), messageWorker.close(), messageQueue.close(), dlq.close(), db.close()]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void start();
