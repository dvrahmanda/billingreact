import React from 'react';
import DocumentTitle from './components/layout/DocumentTitle';
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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-center"><div className="spinner" /></div>;
  return user && ['superadmin', 'admin', 'relawan'].includes(user.role) ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  return ['superadmin', 'admin'].includes(user?.role) ? children : <Navigate to="/dashboard" replace />;
}

function SuperAdminRoute({ children }) {
  const { user } = useAuth();
  return user?.role === 'superadmin' ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      <DocumentTitle />
      <Routes>
      <Route path="/login" element={user && ['superadmin', 'admin', 'relawan'].includes(user.role) ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="customers" element={<CustomerListPage />} />
        <Route path="customers/new" element={<AdminRoute><CustomerFormPage mode="create" /></AdminRoute>} />
        <Route path="customers/:id/edit" element={<AdminRoute><CustomerFormPage mode="edit" /></AdminRoute>} />
        <Route path="customers/import" element={<AdminRoute><CustomerImportPage /></AdminRoute>} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="billings" element={<BillListPage />} />
        <Route path="billings/:id" element={<BillDetailPage />} />
        <Route path="payments" element={<PaymentHistoryPage />} />
        <Route path="payments/matching" element={<AdminRoute><PaymentMatchingPage /></AdminRoute>} />
        <Route path="network/monitoring" element={<AdminRoute><PPPoEMonitoringPage /></AdminRoute>} />
        <Route path="network/mapping" element={<AdminRoute><PPPoEMappingPage /></AdminRoute>} />
        <Route path="network/map" element={<AdminRoute><CustomerGeoMapPage /></AdminRoute>} />
        <Route path="complaints" element={<AdminRoute><ComplaintListPage /></AdminRoute>} />
        <Route path="complaints/:id" element={<AdminRoute><ComplaintDetailPage /></AdminRoute>} />
        <Route path="technicians/monitoring" element={<AdminRoute><TechnicianMonitoringPage /></AdminRoute>} />
        <Route path="management/technicians" element={<SuperAdminRoute><TechnicianManagePage /></SuperAdminRoute>} />
        <Route path="reports/financial" element={<AdminRoute><FinancialReportPage /></AdminRoute>} />
        <Route path="analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
        <Route path="management/admins" element={<AdminRoute><RegionalAdminPage /></AdminRoute>} />
        <Route path="activity" element={<SuperAdminRoute><ActivityPage /></SuperAdminRoute>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </>
  );
}
