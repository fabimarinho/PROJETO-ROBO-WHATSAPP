import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser } from '../../shared/auth/auth.types';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { TenantAccessGuard } from '../../shared/guards/tenant-access.guard';
import { TenantsService } from '../tenants/tenants.service';
import { Campaign, CampaignLog, CampaignMetrics } from './campaign.model';
import { CampaignsService } from './campaigns.service';

@UseGuards(TenantAccessGuard)
@Controller('tenants/:tenantId/campaigns')
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly tenantsService: TenantsService
  ) {}

  @Roles('owner', 'admin', 'operator')
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Body() body: { name: string; templateName: string },
    @CurrentUser() user: AuthUser
  ): Promise<Campaign> {
    await this.tenantsService.getOrThrow(tenantId);
    return this.campaignsService.create({
      tenantId,
      name: body.name,
      templateName: body.templateName,
      createdBy: user.userId
    });
  }

  @Get()
  async list(@Param('tenantId') tenantId: string): Promise<Campaign[]> {
    await this.tenantsService.getOrThrow(tenantId);
    return this.campaignsService.listByTenant(tenantId);
  }

  @Roles('owner', 'admin', 'operator')
  @Post(':campaignId/launch')
  async launch(@Param('tenantId') tenantId: string, @Param('campaignId') campaignId: string): Promise<Campaign> {
    await this.tenantsService.getOrThrow(tenantId);
    return this.campaignsService.launch(tenantId, campaignId);
  }

  @Get(':campaignId/metrics')
  async metrics(@Param('tenantId') tenantId: string, @Param('campaignId') campaignId: string): Promise<CampaignMetrics> {
    await this.tenantsService.getOrThrow(tenantId);
    return this.campaignsService.getMetrics(tenantId, campaignId);
  }

  @Get(':campaignId/logs')
  async logs(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string
  ): Promise<CampaignLog[]> {
    await this.tenantsService.getOrThrow(tenantId);
    return this.campaignsService.getLogs(tenantId, campaignId);
  }

  @Roles('owner', 'admin', 'operator')
  @Post(':campaignId/humanization-config')
  async configureHumanization(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
    @Body()
    body: {
      name?: string;
      enabled: boolean;
      rotationStrategy: 'round_robin' | 'random';
      baseTemplateText: string;
      phraseBank: { openers?: string[]; bodies?: string[]; closings?: string[] };
      syntacticVariationLevel: number;
      minDelayMs: number;
      maxDelayMs: number;
    }
  ): Promise<{ configured: true }> {
    await this.tenantsService.getOrThrow(tenantId);
    await this.campaignsService.configureHumanization(tenantId, campaignId, body);
    return { configured: true };
  }

  @Get(':campaignId/humanization-config')
  async getHumanizationConfig(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string
  ): Promise<unknown> {
    await this.tenantsService.getOrThrow(tenantId);
    return this.campaignsService.getHumanizationConfig(tenantId, campaignId);
  }

  @Get(':campaignId/humanization-preview')
  async previewHumanization(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
    @Query('contactId') contactId: string,
    @Query('count') count?: string
  ): Promise<Array<{ text: string; hash: string; delayMs: number }>> {
    await this.tenantsService.getOrThrow(tenantId);
    return this.campaignsService.previewHumanization(
      tenantId,
      campaignId,
      contactId,
      count ? Number(count) : 5
    );
  }
}
