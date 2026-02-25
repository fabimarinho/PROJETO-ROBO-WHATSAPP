import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/auth/auth.types';
import { TenantAccessGuard } from '../../shared/guards/tenant-access.guard';
import { UsersService } from './users.service';

@UseGuards(TenantAccessGuard)
@Controller('tenants/:tenantId/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('owner', 'admin')
  @Get()
  list(
    @Param('tenantId') tenantId: string
  ): Promise<Array<{ userId: string; email: string; role: UserRole; status: string }>> {
    return this.usersService.listByTenant(tenantId);
  }

  @Roles('owner', 'admin')
  @Post('invite')
  invite(
    @Param('tenantId') tenantId: string,
    @Body() body: { email: string; role: UserRole; temporaryPassword: string }
  ): Promise<void> {
    return this.usersService.invite({
      tenantId,
      email: body.email,
      role: body.role,
      temporaryPassword: body.temporaryPassword
    });
  }
}
