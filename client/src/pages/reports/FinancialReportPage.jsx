import React, { useEffect, useState } from 'react';
import { apiDownload, apiGet } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/common/StatCard';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import { ReceiptText, CircleDollarSign, TriangleAlert, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateIndo, formatRupiah } from '../../utils/formatters';

const regions = ['BARAN', 'GUNUNGMANUK', 'NGASEMAYU', 'SALAM', 'TROSARI', 'WADUK'];

export default function FinancialReportPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [paidFrom, setPaidFrom] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [status, setStatus] = useState('');
  const [customerStatus, setCustomerStatus] = useState('');
  const [method, setMethod] = useState('');
  const [wilayah, setWilayah] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = () => {
    const query = new URLSearchParams();
    if (periodFrom) query.set('periode_from', periodFrom);
    if (periodTo) query.set('periode_to', periodTo);
    if (paidFrom) query.set('paid_from', paidFrom);
    if (paidTo) query.set('paid_to', paidTo);
    if (status) query.set('status', status);
    if (customerStatus) query.set('customer_status', customerStatus);
    if (method) query.set('metode', method);
    if (search.trim()) query.set('q', search.trim());
    if (user?.role === 'superadmin') query.set('wilayah', wilayah);
    query.set('page', String(page)); query.set('page_size', '25');
    return query;
  };
  const load = async (nextPage = page) => {
    setLoading(true); setError('');
    const oldPage = page;
    if (nextPage !== page) setPage(nextPage);
    const query = params(); query.set('page', String(nextPage));
    try { const result = await apiGet(`/reports/financial?${query}`); setData(result.data || null); }
    catch (requestError) { setError(requestError.friendlyMessage || 'Laporan gagal dimuat.'); }
    finally { setLoading(false); }
    return oldPage;
  };
  useEffect(() => { load(1); }, []);

  const printFullReport = async () => {
    const popup = window.open('', '_blank');
    if (!popup) { window.print(); return; }
    try {
      const query = params(); query.set('page_size', '100'); query.set('page', '1');
      const first = await apiGet(`/reports/financial?${query}`);
      const report = first.data || {};
      const rows = [...(report.details || [])];
      for (let current = 2; current <= Number(report.pagination?.pages || 1); current += 1) {
        query.set('page', String(current));
        const next = await apiGet(`/reports/financial?${query}`);
        rows.push(...(next.data?.details || []));
      }
      const escape = (value) => String(value ?? '-').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
      const totals = report.summary || {};
      popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Laporan Keuangan Life Media</title><style>body{font:12px Arial,sans-serif;color:#16283c;padding:24px}h1{font-size:20px}p{color:#526273}.totals{display:flex;gap:20px;margin:18px 0}.totals div{padding:10px;border:1px solid #d8e0e8}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cfd8e2;padding:6px;text-align:left}th{background:#eef3f7}@media print{body{padding:0}tr{break-inside:avoid}}</style></head><body><h1>Laporan Keuangan Life Media</h1><p>Jumlah data: ${rows.length} · Dicetak ${new Date().toLocaleString('id-ID')}</p><div class="totals"><div>Total Tagihan<br><b>${escape(formatRupiah(totals.total_tagihan))}</b></div><div>Total Pembayaran<br><b>${escape(formatRupiah(totals.total_pembayaran))}</b></div><div>Tunggakan<br><b>${escape(formatRupiah(totals.total_tunggakan))}</b></div><div>Lunas<br><b>${escape(totals.lunas || 0)}</b></div></div><table><thead><tr><th>Invoice</th><th>ID Pelanggan</th><th>Nama</th><th>Wilayah</th><th>Periode</th><th>Nominal</th><th>Status</th><th>Tanggal Bayar</th><th>Metode</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escape(row.nomor_invoice)}</td><td>${escape(row.id_pelanggan_snapshot)}</td><td>${escape(row.nama_snapshot)}</td><td>${escape(row.alamat_snapshot)}</td><td>${escape(row.periode)}</td><td>${escape(formatRupiah(row.nominal_tagihan))}</td><td>${escape(row.status_bayar)}</td><td>${escape(row.tanggal_bayar || '-')}</td><td>${escape(row.metode_pembayaran)}</td></tr>`).join('')}</tbody></table></body></html>`);
      popup.document.close();
      window.setTimeout(() => { popup.focus(); popup.print(); }, 300);
    } catch (requestError) { popup.close(); setError(requestError.friendlyMessage || 'Laporan PDF gagal disiapkan.'); }
  };

  const summary = data?.summary || { total_tagihan: 0, total_pembayaran: 0, total_tunggakan: 0, lunas: 0, belum_lunas: 0 };
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };
  const columns = [
    { header: 'Invoice', accessor: 'nomor_invoice' },
    { header: 'ID Pelanggan', accessor: 'id_pelanggan_snapshot' },
    { header: 'Nama', accessor: 'nama_snapshot' },
    { header: 'Wilayah', accessor: 'alamat_snapshot' },
    { header: 'Periode', accessor: (row) => formatDateIndo(row.periode) },
    { header: 'Nominal', accessor: (row) => formatRupiah(row.nominal_tagihan) },
    { header: 'Status Tagihan', accessor: 'status_bayar' },
    { header: 'Status Pelanggan', accessor: 'status_pelanggan' },
    { header: 'Tanggal Bayar', accessor: (row) => row.tanggal_bayar ? formatDateIndo(row.tanggal_bayar, true) : '-' },
    { header: 'Metode', accessor: 'metode_pembayaran' },
  ];

  return <div className="page-container report-print-area">
    <div className="page-header"><div><h1>Laporan Keuangan</h1><p>Filter tagihan berdasarkan periode, tanggal pembayaran, status, metode, pelanggan, dan wilayah sesuai hak akses.</p></div><div className="header-actions"><Button variant="outline" onClick={printFullReport}>Export PDF / Cetak</Button><Button onClick={() => apiDownload(`/reports/financial/export?${params()}`, 'laporan-keuangan.xlsx').catch((requestError) => setError(requestError.friendlyMessage || 'Export gagal.'))}>Export Excel</Button></div></div>
    {error && <div className="alert alert-danger">{error}</div>}
    <div className="filter-bar">
      <label>Periode dari <input type="month" className="form-control" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} /></label>
      <label>Periode sampai <input type="month" className="form-control" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} /></label>
      <label>Bayar dari <input type="date" className="form-control" value={paidFrom} onChange={(event) => setPaidFrom(event.target.value)} /></label>
      <label>Bayar sampai <input type="date" className="form-control" value={paidTo} onChange={(event) => setPaidTo(event.target.value)} /></label>
      <select className="form-control" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua Status Tagihan</option><option>Lunas</option><option>Belum Lunas</option></select>
      <select className="form-control" value={customerStatus} onChange={(event) => setCustomerStatus(event.target.value)}><option value="">Semua Status Pelanggan</option><option>Aktif</option><option>Tidak Aktif</option></select>
      <select className="form-control" value={method} onChange={(event) => setMethod(event.target.value)}><option value="">Semua Metode</option><option>Midtrans</option><option>Transfer Manual</option></select>
      {user?.role === 'superadmin' && <select className="form-control" value={wilayah} onChange={(event) => setWilayah(event.target.value)}><option value="all">Semua Wilayah</option>{regions.map((item) => <option key={item}>{item}</option>)}</select>}
      <input className="form-control search-input" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(1); }} placeholder="Cari nama, ID, atau invoice" />
      <Button onClick={() => load(1)} disabled={loading}>Terapkan</Button>
    </div>
    <div className="stats-grid"><StatCard label="Total Tagihan" value={formatRupiah(summary.total_tagihan)} icon={ReceiptText} /><StatCard label="Total Pembayaran" value={formatRupiah(summary.total_pembayaran)} icon={CheckCircle2} tone="success" /><StatCard label="Tunggakan" value={formatRupiah(summary.total_tunggakan)} icon={TriangleAlert} tone="danger" /><StatCard label="Transaksi Lunas" value={summary.lunas} icon={CircleDollarSign} tone="success" /></div>
    <div className="card"><div className="card-header"><strong>Ringkasan per Wilayah</strong></div><DataTable columns={[{ header: 'Wilayah', accessor: 'wilayah' }, { header: 'Tagihan', accessor: (row) => formatRupiah(row.total_tagihan) }, { header: 'Pembayaran', accessor: (row) => formatRupiah(row.total_pembayaran) }, { header: 'Tunggakan', accessor: (row) => formatRupiah(row.total_tunggakan) }, { header: 'Lunas', accessor: 'lunas' }, { header: 'Belum Lunas', accessor: 'belum_lunas' }]} data={data?.byRegion || []} loading={loading} /></div>
    <div className="card"><div className="card-header"><strong>Rincian Tagihan ({pagination.total})</strong></div><DataTable columns={columns} data={data?.details || []} loading={loading} /><div className="header-actions" style={{ padding: 14, justifyContent: 'space-between', alignItems: 'center' }}><span className="table-sub">Halaman {pagination.page} dari {Math.max(1, pagination.pages)} · {pagination.total} data</span><div className="header-actions"><Button variant="outline" disabled={loading || pagination.page <= 1} onClick={() => load(pagination.page - 1)}><ChevronLeft size={15} />Sebelumnya</Button><Button variant="outline" disabled={loading || pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Berikutnya<ChevronRight size={15} /></Button></div></div></div>
  </div>;
}
