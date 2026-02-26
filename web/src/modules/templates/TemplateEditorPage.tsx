import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';

export function TemplateEditorPage(): JSX.Element {
  const { accessToken } = useAuth();
  const { selectedTenantId } = useTenant();
  const [campaignId, setCampaignId] = useState('');
  const [template, setTemplate] = useState('Oi {{nome}}, tudo bem em {{cidade}}?');
  const [openers, setOpeners] = useState('Oi {{nome}};Ola {{nome}}');
  const [bodies, setBodies] = useState('Tenho uma proposta para {{cidade}}');
  const [closings, setClosings] = useState('Posso te explicar em 1 minuto?');
  const [message, setMessage] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    if (!accessToken || !selectedTenantId || !campaignId) return;
    const response = await fetch(`/v1/tenants/${selectedTenantId}/campaigns/${campaignId}/humanization-config`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enabled: true,
        rotationStrategy: 'round_robin',
        baseTemplateText: template,
        phraseBank: {
          openers: openers.split(';').map((x) => x.trim()).filter(Boolean),
          bodies: bodies.split(';').map((x) => x.trim()).filter(Boolean),
          closings: closings.split(';').map((x) => x.trim()).filter(Boolean)
        },
        syntacticVariationLevel: 2,
        minDelayMs: 400,
        maxDelayMs: 1600
      })
    });
    setMessage(response.ok ? 'Template salvo com sucesso' : 'Erro ao salvar template');
  };

  return (
    <div>
      <PageHeader title="Editor de Template" subtitle="Humanizacao de mensagens com variacoes controladas." />
      <Card>
        <Input label="Campaign ID" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} />
        <label className="field">
          <span className="field-label">Template base</span>
          <textarea className="textarea" rows={4} value={template} onChange={(e) => setTemplate(e.target.value)} />
        </label>
        <Input label="Openers (separados por ;)" value={openers} onChange={(e) => setOpeners(e.target.value)} />
        <Input label="Bodies (separados por ;)" value={bodies} onChange={(e) => setBodies(e.target.value)} />
        <Input label="Closings (separados por ;)" value={closings} onChange={(e) => setClosings(e.target.value)} />
        <Button onClick={save}>Salvar Configuracao</Button>
        {message ? <p>{message}</p> : null}
      </Card>
    </div>
  );
}
