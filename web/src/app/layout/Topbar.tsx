import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';

export function Topbar(): JSX.Element {
  const { user, logout } = useAuth();
  const { tenants, selectedTenantId, setSelectedTenantId } = useTenant();

  return (
    <header className="topbar">
      <div className="tenant-switch">
        <label htmlFor="tenant-select">Tenant</label>
        <select
          id="tenant-select"
          value={selectedTenantId ?? ''}
          onChange={(event) => setSelectedTenantId(event.target.value)}
        >
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </div>
      <div className="topbar-user">
        <span>{user?.email}</span>
        <button className="btn btn-secondary" onClick={logout}>
          Sair
        </button>
      </div>
    </header>
  );
}
