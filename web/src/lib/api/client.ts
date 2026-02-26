import type {
  ApiEnvelope,
  BillingStatus,
  BillingUsage,
  Campaign,
  CampaignLog,
  CampaignMetrics,
  Contact,
  LoginResponse,
  Tenant
} from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function resolveUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(resolveUrl(path), { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

export const api = {
  login(email: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },
  refresh(refreshToken: string): Promise<LoginResponse> {
    return request<LoginResponse>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  },
  listTenants(token: string): Promise<Tenant[]> {
    return request<Tenant[]>('/v1/tenants', {}, token);
  },
  listCampaigns(tenantId: string, token: string): Promise<Campaign[]> {
    return request<Campaign[]>(`/v1/tenants/${tenantId}/campaigns`, {}, token);
  },
  createCampaign(tenantId: string, token: string, payload: { name: string; templateName: string }): Promise<Campaign> {
    return request<Campaign>(
      `/v1/tenants/${tenantId}/campaigns`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },
  launchCampaign(tenantId: string, campaignId: string, token: string): Promise<Campaign> {
    return request<Campaign>(`/v1/tenants/${tenantId}/campaigns/${campaignId}/launch`, { method: 'POST' }, token);
  },
  campaignMetrics(tenantId: string, campaignId: string, token: string): Promise<CampaignMetrics> {
    return request<CampaignMetrics>(`/v1/tenants/${tenantId}/campaigns/${campaignId}/metrics`, {}, token);
  },
  campaignLogs(tenantId: string, campaignId: string, token: string): Promise<CampaignLog[]> {
    return request<CampaignLog[]>(`/v1/tenants/${tenantId}/campaigns/${campaignId}/logs`, {}, token);
  },
  listContacts(tenantId: string, token: string): Promise<Contact[]> {
    return request<Contact[]>(`/v1/tenants/${tenantId}/contacts`, {}, token);
  },
  importContactsCsv(tenantId: string, csvContent: string, token: string): Promise<{ total: number; imported: number; invalid: number }> {
    return request<{ total: number; imported: number; invalid: number }>(
      `/v1/tenants/${tenantId}/contacts/import-csv`,
      { method: 'POST', body: JSON.stringify({ csvContent }) },
      token
    );
  },
  billingUsage(tenantId: string, token: string, days = 30): Promise<BillingUsage> {
    return request<BillingUsage>(`/v1/tenants/${tenantId}/billing/usage?days=${days}`, {}, token);
  },
  billingStatus(tenantId: string, token: string): Promise<BillingStatus> {
    return request<BillingStatus>(`/v1/tenants/${tenantId}/billing/status`, {}, token);
  },
  syncPlan(tenantId: string, planCode: string, token: string): Promise<{ planCode: string; stripeProductId: string; stripePriceId: string }> {
    return request<{ planCode: string; stripeProductId: string; stripePriceId: string }>(
      `/v1/tenants/${tenantId}/billing/plans/${planCode}/sync-stripe`,
      { method: 'POST' },
      token
    );
  },
  subscribe(tenantId: string, planCode: string, token: string): Promise<{ externalSubscriptionId: string; status: string }> {
    return request<{ externalSubscriptionId: string; status: string }>(
      `/v1/tenants/${tenantId}/billing/subscription`,
      { method: 'POST', body: JSON.stringify({ planCode }) },
      token
    );
  },
  changePlan(tenantId: string, planCode: string, token: string): Promise<{ changed: true }> {
    return request<{ changed: true }>(
      `/v1/tenants/${tenantId}/billing/subscription/change-plan`,
      { method: 'POST', body: JSON.stringify({ planCode }) },
      token
    );
  },
  cancelSubscription(tenantId: string, token: string): Promise<{ canceled: true }> {
    return request<{ canceled: true }>(`/v1/tenants/${tenantId}/billing/subscription/cancel`, { method: 'POST' }, token);
  }
};
