import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api/client';
import type { Tenant } from '../lib/api/types';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'rw_admin_selected_tenant';

export function useTenant(): {
  tenants: Tenant[];
  selectedTenantId: string | null;
  setSelectedTenantId: (tenantId: string) => void;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const { accessToken } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const reload = async (): Promise<void> => {
    if (!accessToken) {
      setTenants([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.listTenants(accessToken);
      setTenants(data);
      if (!selectedTenantId && data[0]?.id) {
        setSelectedTenantIdState(data[0].id);
        localStorage.setItem(STORAGE_KEY, data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const setSelectedTenantId = (tenantId: string): void => {
    setSelectedTenantIdState(tenantId);
    localStorage.setItem(STORAGE_KEY, tenantId);
  };

  return useMemo(
    () => ({ tenants, selectedTenantId, setSelectedTenantId, loading, reload }),
    [tenants, selectedTenantId, loading]
  );
}
