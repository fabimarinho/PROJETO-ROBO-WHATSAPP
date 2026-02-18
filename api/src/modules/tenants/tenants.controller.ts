import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Tenant } from './tenant.model';
import { TenantsService } from './tenants.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { TenantAccessGuard } from '../../shared/guards/tenant-access.guard';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly authService: AuthService
  ) {}

  @Post()
  async create(@Body() body: { name: string; planCode: string }, @CurrentUser() user: AuthUser): Promise<Tenant> {
    const tenant = await this.tenantsService.create(body);
    await this.authService.addMembership(user.userId, tenant.id, 'owner');
    return tenant;
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<Tenant[]> {
    return this.tenantsService.listByUserId(user.userId);
  }

  @UseGuards(TenantAccessGuard)
  @Get(':tenantId')
  get(@Param('tenantId') tenantId: string): Promise<Tenant> {
    return this.tenantsService.getOrThrow(tenantId);
  }
}
