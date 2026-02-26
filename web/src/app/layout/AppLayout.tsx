import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout(): JSX.Element {
  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <Topbar />
        <section className="content-body">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
