import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class TenantAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      params: Record<string, string | undefined>;
      user: { memberships: Array<{ tenantId: string }> };
    }>();

    const tenantId = request.params.tenantId;
    if (!tenantId) {
      return true;
    }

    const hasAccess = request.user.memberships.some((item) => item.tenantId === tenantId);
    if (!hasAccess) {
      throw new ForbiddenException('Tenant access denied');
    }

    return true;
  }
}
