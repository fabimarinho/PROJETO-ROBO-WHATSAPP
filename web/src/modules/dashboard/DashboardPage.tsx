import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { useDashboardMetrics } from '../../hooks/useDashboardMetrics';
import { useTenant } from '../../hooks/useTenant';

export function DashboardPage(): JSX.Element {
  const { selectedTenantId } = useTenant();
  const { data, loading } = useDashboardMetrics(selectedTenantId);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visao operacional com metricas em tempo real." />
      <div className="kpi-grid">
        <Card>
          <h3>Campanhas</h3>
          <strong>{loading ? '...' : data.campaignCount}</strong>
        </Card>
        <Card>
          <h3>Campanhas Rodando</h3>
          <strong>{loading ? '...' : data.runningCampaigns}</strong>
        </Card>
        <Card>
          <h3>Billable (30d)</h3>
          <strong>{loading ? '...' : data.monthlyBillable}</strong>
        </Card>
        <Card>
          <h3>Entregues (30d)</h3>
          <strong>{loading ? '...' : data.monthlyDelivered}</strong>
        </Card>
      </div>
    </div>
  );
}
