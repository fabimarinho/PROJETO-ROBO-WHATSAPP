import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/upload-csv', label: 'Upload CSV' },
  { to: '/templates', label: 'Template Editor' },
  { to: '/billing', label: 'Plano e Billing' },
  { to: '/whatsapp', label: 'WhatsApp Config' },
  { to: '/logs', label: 'Logs de Envio' }
];

export function Sidebar(): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-badge">RW</span>
        <div>
          <strong>Robo WhatsApp</strong>
          <small>Admin Console</small>
        </div>
      </div>
      <nav className="nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'nav-item nav-item-active' : 'nav-item')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
