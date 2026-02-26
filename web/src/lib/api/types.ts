export type ApiEnvelope<T> = {
  data: T;
  meta: {
    requestId: string | null;
    timestamp: string;
  };
};

export type TenantMembership = {
  tenantId: string;
  role: 'owner' | 'admin' | 'operator' | 'viewer';
};

export type AuthUser = {
  userId: string;
  email: string;
  memberships: TenantMembership[];
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type Tenant = {
  id: string;
  name: string;
  planCode: string;
  status: 'active' | 'inactive';
  createdAt: string;
};

export type Campaign = {
  id: string;
  tenantId: string;
  name: string;
  templateName: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed';
  createdAt: string;
};

export type CampaignMetrics = {
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
};

export type CampaignLog = {
  messageId: string | null;
  eventType: string;
  eventSource: string;
  eventAt: string;
  payload: unknown;
};

export type Contact = {
  id: string;
  tenantId: string;
  phoneE164: string;
  waId: string | null;
  consentStatus: string;
  createdAt: string;
};

export type BillingUsage = {
  days: number;
  totals: { sent: number; delivered: number; failed: number; billable: number };
  daily: Array<{ day: string; sent: number; delivered: number; failed: number; billable: number }>;
};

export type BillingStatus = {
  tenantStatus: string;
  tenantPlanCode: string;
  subscriptionStatus: string | null;
  messageLimitMonthly: number | null;
  usedThisMonth: number;
  canDispatch: boolean;
};
