import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Campaign, CampaignLog, CampaignMetrics } from './campaign.model';
import { CampaignsService } from './campaigns.service';
import { TenantsService } from '../tenants/tenants.service';
import { TenantAccessGuard } from '../../shared/guards/tenant-access.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/auth/auth.types';

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
}
