import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api/client';
import type { BillingUsage, Campaign } from '../lib/api/types';
import { useAuth } from './useAuth';

type DashboardMetrics = {
  campaignCount: number;
  runningCampaigns: number;
  monthlyBillable: number;
  monthlyDelivered: number;
  monthlyFailed: number;
};

export function useDashboardMetrics(tenantId: string | null): {
  data: DashboardMetrics;
  campaigns: Campaign[];
  usage: BillingUsage | null;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const { accessToken } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = async (): Promise<void> => {
    if (!accessToken || !tenantId) {
      return;
    }
    setLoading(true);
    try {
      const [campaignData, usageData] = await Promise.all([
        api.listCampaigns(tenantId, accessToken),
        api.billingUsage(tenantId, accessToken, 30)
      ]);
      setCampaigns(campaignData);
      setUsage(usageData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId]);

  const data = useMemo<DashboardMetrics>(() => {
    const totals = usage?.totals ?? { billable: 0, delivered: 0, failed: 0 };
    return {
      campaignCount: campaigns.length,
      runningCampaigns: campaigns.filter((item) => item.status === 'running').length,
      monthlyBillable: totals.billable,
      monthlyDelivered: totals.delivered,
      monthlyFailed: totals.failed
    };
  }, [campaigns, usage]);

  return { data, campaigns, usage, loading, reload };
}
