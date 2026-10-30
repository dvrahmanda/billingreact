import React, { useEffect, useState } from 'react';
import { apiDownload, apiGet } from '../../services/api';
import Button from '../../components/common/Button';
import DataTable from '../../components/common/DataTable';
import Badge, { statusVariant } from '../../components/common/Badge';
import { formatRupiah, formatDateIndo, labelStatus } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

export default function PaymentHistoryPage() {
  const { user } = useAuth();
  const isRelawan = user?.role === 'relawan';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');

  const load = () => {
    setLoading(true);
    apiGet('/payments?status=' + encodeURIComponent(status) + '&metode=' + encodeURIComponent(method))
      .then((response) => setRows(response.data || []))
      .catch((error) => alert(error.friendlyMessage || 'Pembayaran gagal dimuat.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const columns = [
    { header: 'Order ID', accessor: 'order_id' },
    { header: 'Pelanggan', accessor: (row) => <div><div className="table-title">{row.nama}</div><div className="table-sub">{row.id_pelanggan} · {row.alamat}</div></div> },
    { header: 'Tipe', accessor: (row) => row.tipe_pembayaran === 'midtrans' ? 'Midtrans' : 'Manual (arsip lama)' },
    { header: 'Nominal', accessor: (row) => formatRupiah(row.nominal_dibayar) },
    { header: 'Tanggal', accessor: (row) => formatDateIndo(row.created_at, true) },
    { header: 'Status', accessor: (row) => <Badge variant={statusVariant(row.status)}>{labelStatus(row.status)}</Badge> },
  ];

  return <div className="page-container">
    <div className="page-header">
      <div><h1>Riwayat Pembayaran</h1><p>{isRelawan?'Riwayat pembayaran pelanggan di wilayah tugas.':'Pembayaran pelanggan dilakukan melalui Midtrans. Transaksi manual lama, jika ada, hanya ditampilkan sebagai arsip.'}</p></div>
      {!isRelawan&&<Button variant="outline" onClick={() => apiDownload('/payments/export', 'pembayaran.xlsx').catch((error) => alert(error.friendlyMessage || 'Export gagal.'))}>Export Excel</Button>}
    </div>
    <div className="filter-bar">
      <select className="form-control" style={{ width: 220 }} value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">Semua Status</option>
        {['pending', 'menunggu_verifikasi', 'lunas', 'ditolak', 'expired', 'gagal'].map((item) => <option value={item} key={item}>{labelStatus(item)}</option>)}
      </select>
      <select className="form-control" style={{ width: 220 }} value={method} onChange={(event) => setMethod(event.target.value)}>
        <option value="">Semua Tipe Pembayaran</option>
        <option value="Midtrans">Midtrans</option>
      </select>
      <Button onClick={load}>Terapkan</Button>
    </div>
    <DataTable columns={columns} data={rows} loading={loading} />
  </div>;
}
