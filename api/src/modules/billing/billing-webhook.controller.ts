import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Public } from '../../shared/decorators/public.decorator';
import { BillingService } from './billing.service';

@Controller('webhooks/stripe')
export class BillingWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: { rawBody?: Buffer },
    @Body() body: unknown,
    @Headers('stripe-signature') signatureHeader?: string
  ): Promise<{ received: true; processed: boolean }> {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
    this.billingService.verifyStripeSignature(rawBody, signatureHeader);
    const event = body as { id: string; type: string; data?: { object?: Record<string, unknown> } };
    const handled = await this.billingService.handleStripeWebhook(event);
    return { received: true, processed: handled.processed };
  }
}
