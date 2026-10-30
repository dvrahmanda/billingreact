import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PAGE_TITLES = [
  [/^\/customers\/new\/?$/, 'Tambah Pelanggan'],
  [/^\/customers\/import\/?$/, 'Import Data Pelanggan'],
  [/^\/customers\/[^/]+\/edit\/?$/, 'Edit Pelanggan'],
  [/^\/customers\/[^/]+\/?$/, 'Detail Pelanggan'],
  [/^\/customers\/?$/, 'Data Pelanggan'],
  [/^\/billings\/[^/]+\/?$/, 'Detail Tagihan'],
  [/^\/billings\/?$/, 'Tagihan'],
  [/^\/payments\/matching\/?$/, 'Verifikasi Pembayaran'],
  [/^\/payments\/?$/, 'Riwayat Pembayaran'],
  [/^\/network\/monitoring\/?$/, 'Monitoring PPPoE'],
  [/^\/network\/mapping\/?$/, 'Pemetaan PPPoE'],
  [/^\/network\/map\/?$/, 'Peta Persebaran PPPoE'],
  [/^\/complaints\/[^/]+\/?$/, 'Detail Gangguan'],
  [/^\/complaints\/?$/, 'Layanan Gangguan'],
  [/^\/technicians\/monitoring\/?$/, 'Monitoring Teknisi'],
  [/^\/management\/technicians\/?$/, 'Manajemen Teknisi'],
  [/^\/reports\/financial\/?$/, 'Laporan Keuangan'],
  [/^\/analytics\/?$/, 'Laporan dan Analisis'],
  [/^\/management\/admins\/?$/, 'Admin per Wilayah'],
  [/^\/activity\/?$/, 'Log Aktivitas'],
  [/^\/notifications\/?$/, 'Notifikasi'],
];

function getPageTitle(pathname, user) {
  if (pathname === '/login') return 'Login - Billing Multiwilayah';
  if (pathname === '/' || pathname === '/dashboard') {
    const scope = user?.role === 'superadmin'
      ? 'SEMUA WILAYAH'
      : (user?.wilayah || 'WILAYAH').toUpperCase();
    return 'Dashboard Billing ' + scope + ' | CLEON';
  }

  const match = PAGE_TITLES.find(([pattern]) => pattern.test(pathname));
  if (match) return match[1] + ' | CLEON';
  return 'Billing CLEON';
}

export default function DocumentTitle() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    document.title = getPageTitle(pathname, user);
  }, [pathname, user?.role, user?.wilayah]);

  return null;
}
