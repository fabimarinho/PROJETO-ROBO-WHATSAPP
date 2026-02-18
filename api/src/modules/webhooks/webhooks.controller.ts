import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import { Public } from '../../shared/decorators/public.decorator';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks/meta/whatsapp/:tenantId')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string
  ): string {
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'dev-verify-token';
    if (mode === 'subscribe' && verifyToken === expected) {
      return challenge;
    }

    throw new UnauthorizedException('Invalid verify token');
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('tenantId') tenantId: string,
    @Req() req: { rawBody?: Buffer },
    @Body() body: unknown,
    @Headers('x-hub-signature-256') signature?: string
  ): Promise<{ received: boolean; signatureOk: boolean; reconciled: number }> {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
    const signatureOk = await this.webhooksService.verifySignature(rawBody, signature);
    await this.webhooksService.storeEvent(tenantId, body, signatureOk);

    const reconciled = signatureOk ? await this.webhooksService.reconcileMessageStatuses(tenantId, body) : 0;
    return { received: true, signatureOk, reconciled };
  }
}
