import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../auth/auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      params: Record<string, string | undefined>;
      user: { memberships: Array<{ tenantId: string; role: UserRole }> };
    }>();

    const tenantId = request.params.tenantId;
    if (!tenantId) {
      return true;
    }

    const membership = request.user.memberships.find((item) => item.tenantId === tenantId);
    if (!membership) {
      throw new ForbiddenException('Tenant membership not found');
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Role not allowed for this action');
    }

    return true;
  }
}
