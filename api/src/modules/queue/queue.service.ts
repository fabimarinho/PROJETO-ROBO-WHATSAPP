import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { randomInt } from 'node:crypto';
import { StructuredLoggerService } from '../../shared/logging/structured-logger.service';
import { CampaignLaunchJob, MessageSendJob } from './queue.types';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly campaignQueue: Queue<CampaignLaunchJob>;
  private readonly messageQueue: Queue<MessageSendJob>;

  constructor(private readonly logger: StructuredLoggerService) {
    const connection = {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD
    };

    this.campaignQueue = new Queue<CampaignLaunchJob>(process.env.BULLMQ_CAMPAIGN_QUEUE ?? 'campaign.launch', {
      connection
    });
    this.messageQueue = new Queue<MessageSendJob>(process.env.BULLMQ_MESSAGE_QUEUE ?? 'message.send', { connection });
  }

  async enqueueCampaignLaunch(job: CampaignLaunchJob): Promise<void> {
    await this.campaignQueue.add(`launch:${job.tenantId}:${job.campaignId}`, job, this.defaultOptions());
  }

  async enqueueMessageSend(job: MessageSendJob): Promise<void> {
    await this.messageQueue.add(`send:${job.tenantId}:${job.messageId}`, job, this.defaultOptions());
  }

  private defaultOptions(): JobsOptions {
    return {
      attempts: Number(process.env.BULLMQ_MAX_ATTEMPTS ?? 5),
      removeOnComplete: 2000,
      removeOnFail: false,
      backoff: {
        type: 'exponential',
        delay: Number(process.env.BULLMQ_RETRY_DELAY_MS ?? 3000)
      },
      delay: randomInt(0, Number(process.env.BULLMQ_MAX_RANDOM_DELAY_MS ?? 2000))
    };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.campaignQueue.close(), this.messageQueue.close()]);
    this.logger.log({ type: 'bullmq_queue_closed' }, 'QueueService');
  }
}
