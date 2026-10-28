import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CustomerListPage from './pages/customers/CustomerListPage';
import CustomerFormPage from './pages/customers/CustomerFormPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import CustomerImportPage from './pages/customers/CustomerImportPage';
import BillListPage from './pages/billing/BillListPage';
import BillDetailPage from './pages/billing/BillDetailPage';
import PaymentHistoryPage from './pages/payments/PaymentHistoryPage';
import ManualPaymentVerifyPage from './pages/payments/ManualPaymentVerifyPage';
import PaymentMatchingPage from './pages/payments/PaymentMatchingPage';
import PPPoEMonitoringPage from './pages/network/PPPoEMonitoringPage';
import PPPoEMappingPage from './pages/network/PPPoEMappingPage';
import CustomerGeoMapPage from './pages/network/CustomerGeoMapPage';
import ComplaintListPage from './pages/complaints/ComplaintListPage';
import ComplaintDetailPage from './pages/complaints/ComplaintDetailPage';
import TechnicianMonitoringPage from './pages/technicians/TechnicianMonitoringPage';
import TechnicianManagePage from './pages/technicians/TechnicianManagePage';
import FinancialReportPage from './pages/reports/FinancialReportPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import RegionalAdminPage from './pages/management/RegionalAdminPage';
import ActivityPage from './pages/management/ActivityPage';
import NotFoundPage from './pages/management/NotFoundPage';
import NotificationsPage from './pages/management/NotificationsPage';
import RegionSettingsPage from './pages/management/RegionSettingsPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-center"><div className="spinner" /></div>;
  return user && ['superadmin', 'admin'].includes(user.role) ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user && ['superadmin', 'admin'].includes(user.role) ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="customers" element={<CustomerListPage />} />
        <Route path="customers/new" element={<CustomerFormPage mode="create" />} />
        <Route path="customers/:id/edit" element={<CustomerFormPage mode="edit" />} />
        <Route path="customers/import" element={<CustomerImportPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="billings" element={<BillListPage />} />
        <Route path="billings/:id" element={<BillDetailPage />} />
        <Route path="payments" element={<PaymentHistoryPage />} />
        <Route path="payments/manual" element={<ManualPaymentVerifyPage />} />
        <Route path="payments/matching" element={<PaymentMatchingPage />} />
        <Route path="network/monitoring" element={<PPPoEMonitoringPage />} />
        <Route path="network/mapping" element={<PPPoEMappingPage />} />
        <Route path="network/map" element={<CustomerGeoMapPage />} />
        <Route path="complaints" element={<ComplaintListPage />} />
        <Route path="complaints/:id" element={<ComplaintDetailPage />} />
        <Route path="technicians/monitoring" element={<TechnicianMonitoringPage />} />
        <Route path="management/technicians" element={<TechnicianManagePage />} />
        <Route path="reports/financial" element={<FinancialReportPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="management/admins" element={<RegionalAdminPage />} />
        <Route path="management/region-settings" element={<RegionSettingsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
