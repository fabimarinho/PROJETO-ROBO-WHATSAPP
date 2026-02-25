import { UserRole } from '../../../../shared/auth/auth.types';

export class TenantUser {
  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly email: string,
    public readonly role: UserRole,
    public readonly status: string
  ) {}
}
