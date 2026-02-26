import { useState } from 'react';
import Papa from 'papaparse';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api/client';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';

export function UploadCsvPage(): JSX.Element {
  const { accessToken } = useAuth();
  const { selectedTenantId } = useTenant();
  const [csvContent, setCsvContent] = useState('');
  const [result, setResult] = useState<{ total: number; imported: number; invalid: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File): Promise<void> => {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true });
    const normalized = parsed.data
      .filter((row) => row.phoneE164 || row.phone_e164 || row.phone)
      .map((row) => ({
        phoneE164: row.phoneE164 ?? row.phone_e164 ?? row.phone ?? '',
        waId: row.waId ?? row.wa_id ?? '',
        consentStatus: row.consentStatus ?? row.consent_status ?? 'unknown'
      }));
    const header = 'phoneE164,waId,consentStatus';
    const lines = normalized.map((row) => `${row.phoneE164},${row.waId},${row.consentStatus}`);
    setCsvContent([header, ...lines].join('\n'));
  };

  const upload = async (): Promise<void> => {
    if (!accessToken || !selectedTenantId) return;
    setError(null);
    try {
      const res = await api.importContactsCsv(selectedTenantId, csvContent, accessToken);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload');
    }
  };

  return (
    <div>
      <PageHeader title="Upload CSV" subtitle="Importacao em lote de contatos por tenant." />
      <Card>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void onFile(file);
            }
          }}
        />
        <textarea
          className="textarea"
          value={csvContent}
          onChange={(event) => setCsvContent(event.target.value)}
          rows={12}
          placeholder="phoneE164,waId,consentStatus"
        />
        <Button onClick={upload}>Enviar para API</Button>
        {result ? (
          <p>
            Total: {result.total} | Importados: {result.imported} | Invalidos: {result.invalid}
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </Card>
    </div>
  );
}
