import { Channel, ChannelModel, ConsumeMessage, connect } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { DbClient } from './infra/db-client';
import { PlanRateLimiter, RateLimitError } from './infra/plan-rate-limiter';

type CampaignLaunchJob = {
  tenantId: string;
  campaignId: string;
  requestedAt: string;
  requestId: string;
  attempt?: number;
};

type MessageSendJob = {
  tenantId: string;
  campaignId: string;
  campaignMessageId: string;
  attempt?: number;
};

type SendTarget = {
  campaign_message_id: string;
  phone_e164: string;
  wa_id: string | null;
  template_name: string;
  plan_code: string;
};

const CAMPAIGN_QUEUE = process.env.RABBITMQ_CAMPAIGN_QUEUE ?? 'campaign.launch';
const CAMPAIGN_RETRY_QUEUE = `${CAMPAIGN_QUEUE}.retry`;
const CAMPAIGN_DLQ = `${CAMPAIGN_QUEUE}.dlq`;

const MESSAGE_QUEUE = process.env.RABBITMQ_MESSAGE_QUEUE ?? 'message.send';
const MESSAGE_RETRY_QUEUE = `${MESSAGE_QUEUE}.retry`;
const MESSAGE_DLQ = `${MESSAGE_QUEUE}.dlq`;

const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS ?? 3);

async function setupChannel(channel: Channel): Promise<void> {
  await channel.assertQueue(CAMPAIGN_QUEUE, { durable: true });
  await channel.assertQueue(CAMPAIGN_RETRY_QUEUE, { durable: true });
  await channel.assertQueue(CAMPAIGN_DLQ, { durable: true });

  await channel.assertQueue(MESSAGE_QUEUE, { durable: true });
  await channel.assertQueue(MESSAGE_RETRY_QUEUE, { durable: true });
  await channel.assertQueue(MESSAGE_DLQ, { durable: true });

  await channel.prefetch(20);
}

async function processLaunchJob(db: DbClient, channel: Channel, job: CampaignLaunchJob): Promise<void> {
  const campaignRes = await db.query<{ id: string }>(
    'select id from campaigns where id = $1 and tenant_id = $2 limit 1',
    [job.campaignId, job.tenantId]
  );

  if (campaignRes.rows.length === 0) {
    throw new Error('Campaign not found for launch');
  }

  const contactsRes = await db.query<{ id: string }>(
    `select id from contacts
     where tenant_id = $1 and consent_status in ('opted_in', 'unknown')`,
    [job.tenantId]
  );

  for (const contact of contactsRes.rows) {
    const idempotencyKey = `${job.campaignId}:${contact.id}`;

    const insertRes = await db.query<{ id: string }>(
      `insert into campaign_messages (tenant_id, campaign_id, contact_id, idempotency_key, status)
       values ($1, $2, $3, $4, 'queued')
       on conflict (tenant_id, idempotency_key)
       do update set status = 'queued'
       returning id`,
      [job.tenantId, job.campaignId, contact.id, idempotencyKey]
    );

    channel.sendToQueue(
      MESSAGE_QUEUE,
      Buffer.from(
        JSON.stringify({
          tenantId: job.tenantId,
          campaignId: job.campaignId,
          campaignMessageId: insertRes.rows[0].id,
          attempt: 1
        } satisfies MessageSendJob)
      ),
      {
        persistent: true,
        contentType: 'application/json'
      }
    );
  }

  console.log(
    `[worker] launch campaign=${job.campaignId} tenant=${job.tenantId} contacts=${contactsRes.rows.length}`
  );
}

async function processMessageJob(
  db: DbClient,
  limiter: PlanRateLimiter,
  job: MessageSendJob
): Promise<void> {
  const targetRes = await db.query<SendTarget>(
    `select cm.id as campaign_message_id,
            c.phone_e164,
            c.wa_id,
            t.name as template_name,
            tn.plan_code
     from campaign_messages cm
     inner join contacts c on c.id = cm.contact_id
     inner join campaigns cp on cp.id = cm.campaign_id
     inner join templates t on t.id = cp.template_id
     inner join tenants tn on tn.id = cm.tenant_id
     where cm.id = $1 and cm.tenant_id = $2 and cm.campaign_id = $3
     limit 1`,
    [job.campaignMessageId, job.tenantId, job.campaignId]
  );

  const target = targetRes.rows[0];
  if (!target) {
    throw new Error('Campaign message not found');
  }

  await limiter.assertAllowed(job.tenantId, target.plan_code);

  const recipient = target.wa_id ?? target.phone_e164;
  const result = await sendWhatsappTemplateMessage(recipient, target.template_name);

  if (!result.ok) {
    await db.query(
      `update campaign_messages
       set status = 'failed_retryable',
           error_code = $1,
           attempt_count = attempt_count + 1
       where id = $2`,
      [result.errorCode, target.campaign_message_id]
    );

    throw new Error(result.errorCode);
  }

  await db.query(
    `update campaign_messages
     set status = 'accepted_meta',
         meta_message_id = $1,
         error_code = null,
         attempt_count = attempt_count + 1
     where id = $2`,
    [result.messageId, target.campaign_message_id]
  );
}

async function sendWhatsappTemplateMessage(
  to: string,
  templateName: string
): Promise<{ ok: true; messageId: string } | { ok: false; errorCode: string }> {
  const token = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const apiVersion = process.env.META_GRAPH_VERSION ?? 'v20.0';

  if (!token || !phoneNumberId) {
    return {
      ok: true,
      messageId: `mock-${randomUUID()}`
    };
  }

  const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const response = await fetch(endpoint, {
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
        language: {
          code: 'pt_BR'
        }
      }
    })
  });

  const payload = (await response.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { code?: number; message?: string };
  };

  if (!response.ok) {
    const code = payload.error?.code ? String(payload.error.code) : 'meta_request_failed';
    return { ok: false, errorCode: code };
  }

  const messageId = payload.messages?.[0]?.id;
  if (!messageId) {
    return { ok: false, errorCode: 'meta_missing_message_id' };
  }

  return {
    ok: true,
    messageId
  };
}

function parse<T>(message: ConsumeMessage): T {
  return JSON.parse(message.content.toString()) as T;
}

function retryDelayMs(attempt: number): number {
  return 5000 * attempt;
}

async function enqueueRetry(
  channel: Channel,
  queue: string,
  payload: object,
  attempt: number,
  delayMs?: number
): Promise<void> {
  channel.sendToQueue(queue, Buffer.from(JSON.stringify({ ...payload, attempt })), {
    persistent: true,
    expiration: (delayMs ?? retryDelayMs(attempt)).toString(),
    contentType: 'application/json'
  });
}

async function enqueueDlq(channel: Channel, queue: string, payload: object, reason: string): Promise<void> {
  channel.sendToQueue(
    queue,
    Buffer.from(JSON.stringify({ ...payload, deadLetteredAt: new Date().toISOString(), reason })),
    {
      persistent: true,
      contentType: 'application/json'
    }
  );
}

async function consumeCampaignQueue(channel: Channel, db: DbClient, queue: string): Promise<void> {
  await channel.consume(queue, async (msg) => {
    if (!msg) {
      return;
    }

    const payload = parse<CampaignLaunchJob>(msg);

    try {
      await processLaunchJob(db, channel, payload);
      channel.ack(msg);
    } catch (error) {
      const currentAttempt = payload.attempt ?? 1;
      const nextAttempt = currentAttempt + 1;
      const reason = error instanceof Error ? error.message : 'launch_unknown_error';

      if (nextAttempt <= MAX_ATTEMPTS) {
        await enqueueRetry(channel, CAMPAIGN_RETRY_QUEUE, payload, nextAttempt);
      } else {
        await enqueueDlq(channel, CAMPAIGN_DLQ, payload, reason);
      }

      channel.ack(msg);
    }
  });
}

async function consumeMessageQueue(
  channel: Channel,
  db: DbClient,
  limiter: PlanRateLimiter,
  queue: string
): Promise<void> {
  await channel.consume(queue, async (msg) => {
    if (!msg) {
      return;
    }

    const payload = parse<MessageSendJob>(msg);

    try {
      await processMessageJob(db, limiter, payload);
      channel.ack(msg);
    } catch (error) {
      const currentAttempt = payload.attempt ?? 1;

      if (error instanceof RateLimitError) {
        await db.query(
          `update campaign_messages
           set status = 'rate_limited'
           where id = $1`,
          [payload.campaignMessageId]
        );

        await enqueueRetry(channel, MESSAGE_RETRY_QUEUE, payload, currentAttempt, error.retryAfterMs);
        channel.ack(msg);
        return;
      }

      const nextAttempt = currentAttempt + 1;
      const reason = error instanceof Error ? error.message : 'send_unknown_error';

      if (nextAttempt <= MAX_ATTEMPTS) {
        await enqueueRetry(channel, MESSAGE_RETRY_QUEUE, payload, nextAttempt);
      } else {
        await db.query(
          `update campaign_messages
           set status = 'failed_permanent',
               error_code = $1,
               attempt_count = attempt_count + 1
           where id = $2`,
          [reason, payload.campaignMessageId]
        );

        await enqueueDlq(channel, MESSAGE_DLQ, payload, reason);
      }

      channel.ack(msg);
    }
  });
}

async function start(): Promise<void> {
  const rabbitUrl = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
  const connection: ChannelModel = await connect(rabbitUrl);
  const channel = await connection.createChannel();
  const db = new DbClient();
  const limiter = new PlanRateLimiter();

  await setupChannel(channel);
  await consumeCampaignQueue(channel, db, CAMPAIGN_QUEUE);
  await consumeCampaignQueue(channel, db, CAMPAIGN_RETRY_QUEUE);
  await consumeMessageQueue(channel, db, limiter, MESSAGE_QUEUE);
  await consumeMessageQueue(channel, db, limiter, MESSAGE_RETRY_QUEUE);

  console.log(
    `[worker] ready campaignQueue=${CAMPAIGN_QUEUE} messageQueue=${MESSAGE_QUEUE} maxAttempts=${MAX_ATTEMPTS}`
  );

  process.on('SIGINT', async () => {
    await channel.close();
    await connection.close();
    await limiter.close();
    await db.close();
    process.exit(0);
  });
}

void start();
