import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { api } from '../../lib/api/client';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import type { BillingStatus } from '../../lib/api/types';

export function BillingPage(): JSX.Element {
  const { accessToken } = useAuth();
  const { selectedTenantId } = useTenant();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [planCode, setPlanCode] = useState('starter');
  const [feedback, setFeedback] = useState<string | null>(null);

  const reload = async (): Promise<void> => {
    if (!accessToken || !selectedTenantId) return;
    setStatus(await api.billingStatus(selectedTenantId, accessToken));
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedTenantId]);

  const sync = async (): Promise<void> => {
    if (!accessToken || !selectedTenantId) return;
    const res = await api.syncPlan(selectedTenantId, planCode, accessToken);
    setFeedback(`Plano ${res.planCode} sincronizado no Stripe`);
  };

  const subscribe = async (): Promise<void> => {
    if (!accessToken || !selectedTenantId) return;
    const res = await api.subscribe(selectedTenantId, planCode, accessToken);
    setFeedback(`Assinatura criada: ${res.externalSubscriptionId} (${res.status})`);
    await reload();
  };

  const changePlan = async (): Promise<void> => {
    if (!accessToken || !selectedTenantId) return;
    await api.changePlan(selectedTenantId, planCode, accessToken);
    setFeedback(`Plano alterado para ${planCode}`);
    await reload();
  };

  const cancel = async (): Promise<void> => {
    if (!accessToken || !selectedTenantId) return;
    await api.cancelSubscription(selectedTenantId, accessToken);
    setFeedback('Assinatura cancelada');
    await reload();
  };

  return (
    <div>
      <PageHeader title="Controle de Plano" subtitle="Operacao de assinaturas, limites e recorrencia." />
      <Card>
        <Input label="Plano" value={planCode} onChange={(e) => setPlanCode(e.target.value)} />
        <div className="row">
          <Button onClick={sync}>Sync Plano Stripe</Button>
          <Button onClick={subscribe}>Assinar</Button>
          <Button variant="secondary" onClick={changePlan}>
            Upgrade/Downgrade
          </Button>
          <Button variant="danger" onClick={cancel}>
            Cancelar
          </Button>
        </div>
        {feedback ? <p>{feedback}</p> : null}
      </Card>
      <Card>
        <h3>Status atual</h3>
        {status ? (
          <ul className="plain-list">
            <li>Tenant Status: {status.tenantStatus}</li>
            <li>Plano: {status.tenantPlanCode}</li>
            <li>Subscription: {status.subscriptionStatus ?? 'n/a'}</li>
            <li>Limite mensal: {status.messageLimitMonthly ?? 'ilimitado'}</li>
            <li>Uso mensal: {status.usedThisMonth}</li>
            <li>Pode disparar: {status.canDispatch ? 'sim' : 'nao'}</li>
          </ul>
        ) : (
          <p>Sem dados</p>
        )}
      </Card>
    </div>
  );
}
