import React, { useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, Headphones, Network, ReceiptText, Users, Wifi, WifiOff, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../services/api';
import Card from '../../components/common/Card';
import Badge, { statusVariant } from '../../components/common/Badge';
import DataTable from '../../components/common/DataTable';
import { formatRupiah, labelStatus } from '../../utils/formatters';

const REGIONS = ['BARAN', 'GUNUNGMANUK', 'NGASEMAYU', 'SALAM', 'TROSARI', 'WADUK'];

function SummaryCard({ icon: Icon, tone, category, value, label, details }) {
  return (
    <article className={`dashboard-summary-card tone-${tone}`}>
      <div className="dashboard-summary-icon"><Icon size={19} /></div>
      <div className="dashboard-summary-main">
        <span className="dashboard-summary-category">{category}</span>
        <strong>{value}</strong>
        <span className="dashboard-summary-label">{label}</span>
      </div>
      <div className="dashboard-summary-details">
        {details.map((detail) => (
          <span key={detail.label} className={detail.tone || ''}>
            <small>{detail.label}</small><b>{detail.value}</b>
          </span>
        ))}
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wilayah, setWilayah] = useState('all');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiGet(`/billings/dashboard-stats?wilayah=${encodeURIComponent(wilayah)}`)
      .then((response) => { if (active) setData(response.data); })
      .catch((requestError) => {
        if (active) setError(requestError.friendlyMessage || 'Ringkasan dashboard gagal dimuat.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [wilayah]);

  const stats = data?.stats || {};
  const paymentProgress = useMemo(() => {
    const total = Number(stats.totalTagihan || 0);
    if (!total) return 0;
    return Math.min(100, Math.max(0, Math.round((Number(stats.lunas || 0) / total) * 100)));
  }, [stats.lunas, stats.totalTagihan]);
  const networkTotal = Number(stats.pppoeOnline || 0) + Number(stats.pppoeOffline || 0);
  const onlineShare = networkTotal ? Math.round((Number(stats.pppoeOnline || 0) / networkTotal) * 100) : 0;
  const columns = [
    { header: 'Pelanggan', accessor: (row) => <div><div className="table-title">{row.nama}</div><div className="table-sub">{row.id_pelanggan} | {row.wilayah}</div></div> },
    { header: 'Jenis', accessor: 'kategori' },
    { header: 'Status', accessor: (row) => <Badge variant={statusVariant(row.status)}>{labelStatus(row.status)}</Badge> },
  ];

  if (loading && !data) return <div className="screen-center" style={{ minHeight: 400 }}><div className="spinner" /></div>;

  return (
    <div className="page-container dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <h1>{user?.role === 'superadmin' ? 'Dashboard Super Admin' : `Dashboard ${user?.wilayah || ''}`}</h1>
        </div>
        {user?.role === 'superadmin' && (
          <label className="dashboard-region-filter">
            <span>Wilayah</span>
            <select className="form-control" value={wilayah} onChange={(event) => setWilayah(event.target.value)}>
              <option value="all">Semua Wilayah</option>
              {REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
        )}
      </section>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <section className="dashboard-summary-grid" aria-label="Ringkasan metrik utama">
        <SummaryCard
          icon={Users} tone="blue" category="PELANGGAN"
          value={Number(stats.totalPelanggan || 0).toLocaleString('id-ID')} label="Total pelanggan"
          details={[
            { label: 'Aktif', value: stats.pelangganAktif || 0, tone: 'success' },
            { label: 'Tidak aktif', value: stats.pelangganTidakAktif || 0 },
          ]}
        />
        <SummaryCard
          icon={ReceiptText} tone="amber" category="TAGIHAN"
          value={Number(stats.belumLunas || 0).toLocaleString('id-ID')} label="Belum lunas"
          details={[{ label: 'Total tunggakan', value: formatRupiah(stats.totalTunggakan || 0), tone: 'warning' }]}
        />
        <SummaryCard
          icon={Network} tone="green" category="JARINGAN PPPoE"
          value={Number(stats.pppoeOnline || 0).toLocaleString('id-ID')} label="Koneksi online"
          details={[{ label: 'Offline', value: stats.pppoeOffline || 0, tone: 'danger' }]}
        />
        <SummaryCard
          icon={Headphones} tone="violet" category="GANGGUAN"
          value={Number(stats.complainAktif || 0).toLocaleString('id-ID')} label="Complain aktif"
          details={[
            { label: 'Baru', value: stats.complainBaru || 0, tone: 'warning' },
            { label: 'Teknisi bertugas', value: stats.teknisiBertugas || 0 },
          ]}
        />
      </section>

      <section className="dashboard-details-grid">
        <Card title="Ringkasan pembayaran" className="dashboard-detail-card">
          <div className="dashboard-payment-content">
            <div className="dashboard-payment-figure">
              <div className="dashboard-detail-icon amber"><CircleDollarSign size={18} /></div>
              <div><span>Tagihan lunas</span><strong>{Number(stats.lunas || 0).toLocaleString('id-ID')}</strong><small>{Number(stats.totalTagihan || 0).toLocaleString('id-ID')} tagihan periode ini</small></div>
            </div>
            <div className="dashboard-payment-figure">
              <div className="dashboard-detail-icon blue"><ReceiptText size={18} /></div>
              <div><span>Total pembayaran bulan ini</span><strong>{formatRupiah(stats.totalPembayaran || 0)}</strong><small>Dari transaksi valid</small></div>
            </div>
          </div>
          <div className="dashboard-progress-caption"><span>Pelunasan</span><b>{paymentProgress}%</b></div>
          <div className="dashboard-progress-track"><span style={{ width: `${paymentProgress}%` }} /></div>
        </Card>

        <Card title="Kondisi layanan" className="dashboard-detail-card">
          <div className="dashboard-network-pair">
            <div className="dashboard-network-stat online"><span><Wifi size={15} /> Online</span><strong>{Number(stats.pppoeOnline || 0).toLocaleString('id-ID')} <small>koneksi</small></strong></div>
            <div className="dashboard-network-stat offline"><span><WifiOff size={15} /> Offline</span><strong>{Number(stats.pppoeOffline || 0).toLocaleString('id-ID')} <small>koneksi</small></strong></div>
          </div>
          <div className="dashboard-network-track"><span style={{ width: `${onlineShare}%` }} /></div>
          <div className="dashboard-service-foot"><span><Headphones size={14} /> {Number(stats.complainAktif || 0)} complain aktif</span><span><Wrench size={14} /> {Number(stats.teknisiBertugas || 0)} teknisi bertugas</span></div>
        </Card>
      </section>

      <Card title="Complain terbaru" className="dashboard-complaints-card">
        <DataTable columns={columns} data={data?.recentComplaints || []} loading={loading && !data} emptyText="Belum ada complain aktif." />
      </Card>
    </div>
  );
}
