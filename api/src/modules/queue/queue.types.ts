export type CampaignLaunchJob = {
  tenantId: string;
  campaignId: string;
  requestedAt: string;
  requestId: string;
};

export type MessageSendJob = {
  tenantId: string;
  campaignId: string;
  messageId: string;
  attempt?: number;
};
