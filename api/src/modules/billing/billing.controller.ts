import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../shared/decorators/roles.decorator';
import { TenantAccessGuard } from '../../shared/guards/tenant-access.guard';
import { BillingService } from './billing.service';

@UseGuards(TenantAccessGuard)
@Controller('tenants/:tenantId/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Roles('owner', 'admin')
  @Get('usage')
  usage(
    @Param('tenantId') tenantId: string,
    @Query('days') days?: string
  ): Promise<{
    days: number;
    totals: { sent: number; delivered: number; failed: number; billable: number };
    daily: Array<{ day: string; sent: number; delivered: number; failed: number; billable: number }>;
  }> {
    return this.billingService.getUsage(tenantId, days ? Number(days) : undefined);
  }
}
