import { useEffect, useState } from 'react';
import { api } from '../../lib/api/client';
import type { Campaign } from '../../lib/api/types';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DataTable } from '../../components/ui/DataTable';

export function CampaignsPage(): JSX.Element {
  const { accessToken } = useAuth();
  const { selectedTenantId } = useTenant();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    if (!accessToken || !selectedTenantId) {
      return;
    }
    setLoading(true);
    try {
      setRows(await api.listCampaigns(selectedTenantId, accessToken));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedTenantId]);

  const createCampaign = async (): Promise<void> => {
    if (!accessToken || !selectedTenantId) return;
    setError(null);
    try {
      await api.createCampaign(selectedTenantId, accessToken, { name, templateName });
      setName('');
      setTemplateName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar campanha');
    }
  };

  const launch = async (campaignId: string): Promise<void> => {
    if (!accessToken || !selectedTenantId) return;
    try {
      await api.launchCampaign(selectedTenantId, campaignId, accessToken);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao disparar campanha');
    }
  };

  return (
    <div>
      <PageHeader title="Gestao de Campanhas" subtitle="Crie, monitore e dispare campanhas." />
      <div className="form-grid">
        <Input label="Nome da campanha" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Template" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
        <Button onClick={createCampaign}>Criar Campanha</Button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <DataTable
        rows={rows}
        columns={[
          { key: 'name', header: 'Campanha', render: (row) => row.name },
          { key: 'template', header: 'Template', render: (row) => row.templateName },
          { key: 'status', header: 'Status', render: (row) => row.status },
          { key: 'createdAt', header: 'Criada em', render: (row) => new Date(row.createdAt).toLocaleString() },
          {
            key: 'actions',
            header: 'Acao',
            render: (row) => (
              <Button variant="secondary" onClick={() => launch(row.id)} disabled={loading || row.status === 'running'}>
                Disparar
              </Button>
            )
          }
        ]}
      />
    </div>
  );
}
