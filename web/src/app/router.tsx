import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '../modules/auth/LoginPage';
import { DashboardPage } from '../modules/dashboard/DashboardPage';
import { CampaignsPage } from '../modules/campaigns/CampaignsPage';
import { UploadCsvPage } from '../modules/upload/UploadCsvPage';
import { TemplateEditorPage } from '../modules/templates/TemplateEditorPage';
import { BillingPage } from '../modules/billing/BillingPage';
import { WhatsappConfigPage } from '../modules/whatsapp/WhatsappConfigPage';
import { SendLogsPage } from '../modules/logs/SendLogsPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/campaigns', element: <CampaignsPage /> },
      { path: '/upload-csv', element: <UploadCsvPage /> },
      { path: '/templates', element: <TemplateEditorPage /> },
      { path: '/billing', element: <BillingPage /> },
      { path: '/whatsapp', element: <WhatsappConfigPage /> },
      { path: '/logs', element: <SendLogsPage /> }
    ]
  },
  { path: '*', element: <Navigate to="/" replace /> }
]);
