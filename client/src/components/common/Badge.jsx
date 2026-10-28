import React from 'react';
export default function Badge({ children, variant='neutral' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
export function statusVariant(status='') {
  const s=String(status).toLowerCase();
  if (['lunas','aktif','online','closed','tersedia','terverifikasi','penanganan_selesai'].includes(s)) return 'success';
  if (['ditolak','gagal','offline','tidak aktif','expired'].includes(s)) return 'danger';
  if (['pending','menunggu_verifikasi','menunggu_material','belum lunas'].includes(s)) return 'warning';
  if (['ditugaskan','menuju_lokasi','dalam_penanganan','bertugas'].includes(s)) return 'info';
  return 'neutral';
}
