"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const amqplib_1 = require("amqplib");
const db_client_1 = require("./infra/db-client");
const MAIN_QUEUE = process.env.RABBITMQ_CAMPAIGN_QUEUE ?? 'campaign.launch';
const RETRY_QUEUE = `${MAIN_QUEUE}.retry`;
const DLQ_QUEUE = `${MAIN_QUEUE}.dlq`;
const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS ?? 3);
async function setupChannel(channel) {
    await channel.assertQueue(MAIN_QUEUE, { durable: true });
    await channel.assertQueue(RETRY_QUEUE, { durable: true });
    await channel.assertQueue(DLQ_QUEUE, { durable: true });
    await channel.prefetch(10);
}
async function processLaunchJob(db, job) {
    const exists = await db.query('select id from campaigns where id = $1 and tenant_id = $2 limit 1', [job.campaignId, job.tenantId]);
    if (exists.rows.length === 0) {
        throw new Error('Campaign not found for job');
    }
    await db.query('update campaigns set status = $1 where id = $2 and tenant_id = $3', ['running', job.campaignId, job.tenantId]);
    const queued = await db.query("select count(*)::text as total from campaign_messages where campaign_id = $1 and tenant_id = $2 and status = 'queued'", [job.campaignId, job.tenantId]);
    const queuedTotal = Number(queued.rows[0]?.total ?? '0');
    console.log(`[worker] processing campaign=${job.campaignId} tenant=${job.tenantId} queued=${queuedTotal}`);
    if ((process.env.WORKER_FORCE_FAIL ?? 'false') === 'true') {
        throw new Error('Forced failure for retry validation');
    }
    await db.query('update campaigns set status = $1 where id = $2 and tenant_id = $3', ['completed', job.campaignId, job.tenantId]);
}
function parseJob(message) {
    return JSON.parse(message.content.toString());
}
async function moveToRetry(channel, job, attempt) {
    const nextJob = { ...job, attempt };
    const delayMs = 5000 * attempt;
    channel.sendToQueue(RETRY_QUEUE, Buffer.from(JSON.stringify(nextJob)), {
        persistent: true,
        expiration: delayMs.toString(),
        contentType: 'application/json'
    });
}
async function moveToDlq(channel, job, errorMessage) {
    channel.sendToQueue(DLQ_QUEUE, Buffer.from(JSON.stringify({
        ...job,
        deadLetteredAt: new Date().toISOString(),
        errorMessage
    })), {
        persistent: true,
        contentType: 'application/json'
    });
}
async function consumeQueue(channel, db, queue) {
    await channel.consume(queue, async (msg) => {
        if (!msg) {
            return;
        }
        try {
            const job = parseJob(msg);
            await processLaunchJob(db, job);
            channel.ack(msg);
        }
        catch (error) {
            const job = parseJob(msg);
            const currentAttempt = job.attempt ?? 1;
            const nextAttempt = currentAttempt + 1;
            const reason = error instanceof Error ? error.message : 'unknown_error';
            if (nextAttempt <= MAX_ATTEMPTS) {
                await moveToRetry(channel, job, nextAttempt);
            }
            else {
                await moveToDlq(channel, job, reason);
            }
            channel.ack(msg);
        }
    });
}
async function start() {
    const rabbitUrl = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
    const connection = await (0, amqplib_1.connect)(rabbitUrl);
    const channel = await connection.createChannel();
    const db = new db_client_1.DbClient();
    await setupChannel(channel);
    await consumeQueue(channel, db, MAIN_QUEUE);
    await consumeQueue(channel, db, RETRY_QUEUE);
    console.log(`[worker] connected. main=${MAIN_QUEUE} retry=${RETRY_QUEUE} dlq=${DLQ_QUEUE}`);
    process.on('SIGINT', async () => {
        await channel.close();
        await connection.close();
        await db.close();
        process.exit(0);
    });
}
void start();
