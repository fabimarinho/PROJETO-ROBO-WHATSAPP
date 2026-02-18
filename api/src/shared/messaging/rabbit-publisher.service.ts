import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Channel, ChannelModel, connect } from 'amqplib';

@Injectable()
export class RabbitPublisherService implements OnModuleDestroy {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  async publish(queue: string, payload: object): Promise<void> {
    const channel = await this.getChannel();
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: 'application/json'
    });
  }

  private async getChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    const url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();
    return this.channel;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}
