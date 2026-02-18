export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed';

export type Campaign = {
  id: string;
  tenantId: string;
  name: string;
  templateName: string;
  status: CampaignStatus;
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
