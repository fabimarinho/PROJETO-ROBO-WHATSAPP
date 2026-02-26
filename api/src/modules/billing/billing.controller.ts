import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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

  @Roles('owner', 'admin')
  @Post('plans/:planCode/sync-stripe')
  syncPlan(
    @Param('planCode') planCode: string
  ): Promise<{ planCode: string; stripeProductId: string; stripePriceId: string }> {
    return this.billingService.syncPlanWithStripe(planCode);
  }

  @Roles('owner', 'admin')
  @Post('subscription')
  subscribe(
    @Param('tenantId') tenantId: string,
    @Body() body: { planCode: string }
  ): Promise<{ externalSubscriptionId: string; status: string }> {
    return this.billingService.subscribeMonthly(tenantId, body.planCode);
  }

  @Roles('owner', 'admin')
  @Post('subscription/change-plan')
  changePlan(
    @Param('tenantId') tenantId: string,
    @Body() body: { planCode: string }
  ): Promise<{ changed: true }> {
    return this.billingService.changePlan(tenantId, body.planCode);
  }

  @Roles('owner', 'admin')
  @Post('subscription/cancel')
  cancelSubscription(@Param('tenantId') tenantId: string): Promise<{ canceled: true }> {
    return this.billingService.cancelSubscription(tenantId);
  }

  @Roles('owner', 'admin')
  @Get('status')
  status(@Param('tenantId') tenantId: string): Promise<{
    tenantStatus: string;
    tenantPlanCode: string;
    subscriptionStatus: string | null;
    messageLimitMonthly: number | null;
    usedThisMonth: number;
    canDispatch: boolean;
  }> {
    return this.billingService.getSubscriptionStatus(tenantId);
  }

  @Roles('owner', 'admin')
  @Get('history')
  history(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string
  ): Promise<
    Array<{
      id: string;
      external_invoice_id: string;
      status: string;
      currency_code: string;
      amount_due_cents: number;
      amount_paid_cents: number;
      due_at: string | null;
      paid_at: string | null;
      created_at: string;
    }>
  > {
    return this.billingService.getFinancialHistory(tenantId, limit ? Number(limit) : undefined);
  }
}
