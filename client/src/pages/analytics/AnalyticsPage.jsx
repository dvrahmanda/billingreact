import React, { useEffect, useState } from 'react';
import { apiGet } from '../../services/api';
import Card from '../../components/common/Card';
import StatCard from '../../components/common/StatCard';
import Button from '../../components/common/Button';
import DataTable from '../../components/common/DataTable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatRupiah } from '../../utils/formatters';
import { Users, UserCheck, TriangleAlert, Clock3 } from 'lucide-react';

const colors = ['#142F4A', '#59758D', '#B74846', '#244B68', '#8394A3', '#D1D8E0'];

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet('/analytics');
      setData(result.data || {});
    } catch (requestError) {
      setError(requestError.friendlyMessage || 'Data analitik gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="screen-center" style={{ minHeight: 350 }}><div className="spinner" /></div>;
  if (error) return <div className="page-container"><div className="alert alert-danger">{error}</div><Button onClick={load}>Coba lagi</Button></div>;

  const customer = data.customerStats || {};
  const arrearsByRegion = data.arrearsByRegion || [];
  const paymentStatus = data.paymentStatus || [];
  const paymentTrend = data.paymentTrend || [];
  const complaintStatus = data.complaintStatus || [];
  const pppoeStatus = data.pppoeStatus || [];
  const technicianPerformance = data.technicianPerformance || [];
  const regionalComparison = data.regionalComparison || [];
  const paymentStatusByRegion = data.paymentStatusByRegion || [];
  const unpaidPriorities = data.unpaidPriorities || [];
  const bestPayingCustomers = data.bestPayingCustomers || [];
  const mapSummary = data.mapSummary || [];
  const arrears = arrearsByRegion.reduce((sum, row) => sum + Number(row.nilai || 0), 0);
  const online = Number(pppoeStatus.find((row) => String(row.name).toLowerCase() === 'online')?.value || 0);
  const offline = Number(pppoeStatus.find((row) => String(row.name).toLowerCase() === 'offline')?.value || 0);

  return <div className="page-container">
    <div className="page-header"><div><h1>Analitik</h1><p>Indikator operasional berdasarkan data pelanggan, tagihan, jaringan, keluhan, dan pekerjaan teknisi.</p></div></div>
    <div className="stats-grid">
      <StatCard label="Total Pelanggan" value={customer.total || 0} icon={Users} />
      <StatCard label="Pelanggan Aktif" value={customer.aktif || 0} icon={UserCheck} tone="success" />
      <StatCard label="Total Tunggakan" value={formatRupiah(arrears)} icon={TriangleAlert} tone="danger" />
      <StatCard label="Rata-rata Penanganan" value={data.handlingTimeHours == null ? '—' : `${Number(data.handlingTimeHours).toFixed(1)} jam`} icon={Clock3} />
    </div>
    <div className="charts-grid">
      <Card title="Tunggakan per Wilayah"><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={arrearsByRegion}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="wilayah" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(value) => formatRupiah(value)} /><Bar dataKey="nilai" fill="#244B68" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
      <Card title="Status Pembayaran"><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={paymentStatus} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95}>{paymentStatus.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div></Card>
      <Card title="Tren Pembayaran"><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={paymentTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periode" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(value) => formatRupiah(value)} /><Line type="monotone" dataKey="nilai" stroke="#244B68" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div></Card>
      <Card title="Complain per Status"><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={complaintStatus}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="status" fontSize={9} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="jumlah" fill="#B74846" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
      <Card title="Koneksi PPPoE"><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pppoeStatus} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95}>{pppoeStatus.map((_, index) => <Cell key={index} fill={index ? '#B74846' : '#244B68'} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div><div className="table-sub">Online {online} · Offline {offline}</div></Card>
      <Card title="Pekerjaan Teknisi"><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={technicianPerformance}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nama" fontSize={9} /><YAxis fontSize={10} /><Tooltip /><Legend /><Bar dataKey="aktif" name="Tugas Aktif" fill="#59758D" /><Bar dataKey="selesai" name="Selesai" fill="#244B68" /></BarChart></ResponsiveContainer></div></Card>
      <Card title="Status Tagihan per Wilayah"><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={paymentStatusByRegion}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="wilayah" fontSize={9} /><YAxis fontSize={10} /><Tooltip /><Legend /><Bar dataKey="lunas" name="Lunas" fill="#244B68" /><Bar dataKey="belum_lunas" name="Belum Lunas" fill="#B74846" /></BarChart></ResponsiveContainer></div></Card>
      <Card title="Prioritas Tunggakan"><DataTable columns={[{ header: 'Pelanggan', accessor: (row) => <div><div className="table-title">{row.nama}</div><div className="table-sub">{row.id_pelanggan} · {row.wilayah}</div></div> }, { header: 'Tagihan', accessor: 'jumlah_tagihan' }, { header: 'Tunggakan', accessor: (row) => formatRupiah(row.nilai_tunggakan) }, { header: 'Periode Tertua', accessor: 'periode_tertua' }]} data={unpaidPriorities} emptyText="Tidak ada pelanggan dengan tunggakan." /></Card>
      <Card title="Pelanggan dengan Pembayaran Terbaik"><DataTable columns={[{ header: 'Pelanggan', accessor: (row) => <div><div className="table-title">{row.nama}</div><div className="table-sub">{row.id_pelanggan} · {row.wilayah}</div></div> }, { header: 'Lunas', accessor: 'jumlah_lunas' }, { header: 'Total Tagihan', accessor: 'total_tagihan' }, { header: 'Tingkat Lunas', accessor: (row) => `${row.persentase_lunas}%` }]} data={bestPayingCustomers} emptyText="Belum ada data pembayaran." /></Card>
      <Card title="Perbandingan Wilayah"><DataTable columns={[{ header: 'Wilayah', accessor: 'wilayah' }, { header: 'Pelanggan', accessor: 'pelanggan' }, { header: 'Aktif', accessor: 'aktif' }, { header: 'Total Tagihan', accessor: (row) => formatRupiah(row.total_tagihan) }, { header: 'Tunggakan', accessor: (row) => formatRupiah(row.nilai_tunggakan) }]} data={regionalComparison} emptyText="Data perbandingan wilayah belum tersedia." /></Card>
      <Card title="Data Pelanggan Berkoordinat"><DataTable columns={[{ header: 'Wilayah', accessor: 'wilayah' }, { header: 'Pelanggan di Peta', accessor: 'pelanggan_berkoordinat' }]} data={mapSummary} emptyText="Belum ada koordinat pelanggan." /></Card>
    </div>
  </div>;
}
