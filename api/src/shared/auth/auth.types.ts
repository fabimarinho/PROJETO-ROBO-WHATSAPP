export type UserRole = 'owner' | 'admin' | 'operator' | 'viewer';

export type TenantMembership = {
  tenantId: string;
  role: UserRole;
};

export type AuthUser = {
  userId: string;
  email: string;
  memberships: TenantMembership[];
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  memberships: TenantMembership[];
  typ: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  tokenId: string;
  typ: 'refresh';
};
