import { OutboundMessage } from '../../domain/entities/outbound-message.entity';

export interface EnqueueTemplateMessagePort {
  execute(message: OutboundMessage): Promise<{ messageId: string; queued: true }>;
}
