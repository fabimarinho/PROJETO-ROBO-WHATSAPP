import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function WhatsappConfigPage(): JSX.Element {
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const save = (): void => {
    setMessage('Configuracao salva no frontend. Persistencia backend pode ser adicionada no modulo whatsapp_accounts.');
  };

  return (
    <div>
      <PageHeader title="Configuracao WhatsApp" subtitle="Parmetros operacionais do canal Meta WhatsApp." />
      <Card>
        <Input label="Phone Number ID" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
        <Input label="WABA ID" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
        <Input label="Webhook Verify Token" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} />
        <Button onClick={save}>Salvar Configuracao</Button>
        {message ? <p>{message}</p> : null}
      </Card>
    </div>
  );
}
