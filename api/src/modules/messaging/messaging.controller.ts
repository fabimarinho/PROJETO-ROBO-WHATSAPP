import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../shared/decorators/roles.decorator';
import { TenantAccessGuard } from '../../shared/guards/tenant-access.guard';
import { MessagingService } from './messaging.service';

@UseGuards(TenantAccessGuard)
@Controller('tenants/:tenantId/messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Roles('owner', 'admin', 'operator')
  @Post('send-template')
  sendTemplate(
    @Param('tenantId') tenantId: string,
    @Body() body: { campaignId: string; contactId: string; templateName: string; languageCode?: string }
  ): Promise<{ messageId: string; queued: true }> {
    return this.messagingService.enqueueTemplateMessage({
      tenantId,
      campaignId: body.campaignId,
      contactId: body.contactId,
      templateName: body.templateName,
      languageCode: body.languageCode
    });
  }
}
