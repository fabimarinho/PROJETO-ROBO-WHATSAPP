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
