import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { api } from '../../lib/api/client';
import type { CampaignLog } from '../../lib/api/types';

export function SendLogsPage(): JSX.Element {
  const { accessToken } = useAuth();
  const { selectedTenantId } = useTenant();
  const [campaignId, setCampaignId] = useState('');
  const [rows, setRows] = useState<CampaignLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    if (!accessToken || !selectedTenantId || !campaignId) return;
    setError(null);
    try {
      const data = await api.campaignLogs(selectedTenantId, campaignId, accessToken);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar logs');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedTenantId]);

  return (
    <div>
      <PageHeader title="Logs de Envio" subtitle="Rastreabilidade ponta a ponta por campanha." />
      <div className="form-grid">
        <Input label="Campaign ID" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} />
        <Button onClick={load}>Buscar Logs</Button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <DataTable
        rows={rows}
        columns={[
          { key: 'eventAt', header: 'Data', render: (row) => new Date(row.eventAt).toLocaleString() },
          { key: 'eventType', header: 'Evento', render: (row) => row.eventType },
          { key: 'eventSource', header: 'Fonte', render: (row) => row.eventSource },
          { key: 'messageId', header: 'Message ID', render: (row) => row.messageId ?? '-' }
        ]}
      />
    </div>
  );
}
