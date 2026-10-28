import React,{useEffect,useState} from 'react';
import { Users, UserCheck, ReceiptText, CircleDollarSign, Network, WifiOff, Headphones, Wrench, CreditCard, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../services/api';
import StatCard from '../../components/common/StatCard';
import Card from '../../components/common/Card';
import Badge,{statusVariant} from '../../components/common/Badge';
import DataTable from '../../components/common/DataTable';
import { formatRupiah, labelStatus } from '../../utils/formatters';

export default function DashboardPage(){
 const {user}=useAuth(); const [data,setData]=useState(null); const [loading,setLoading]=useState(true); const [wilayah,setWilayah]=useState('all');
 useEffect(()=>{setLoading(true);apiGet(`/billings/dashboard-stats?wilayah=${wilayah}`).then(r=>setData(r.data)).finally(()=>setLoading(false))},[wilayah]);
 if(loading&&!data)return <div className="screen-center" style={{minHeight:400}}><div className="spinner"/></div>;
 const s=data?.stats||{}; const cards=[
  ['Total Pelanggan',s.totalPelanggan||0,Users,''],['Pelanggan Aktif',s.pelangganAktif||0,UserCheck,'success'],['Pelanggan Tidak Aktif',s.pelangganTidakAktif||0,UserX,''],['Belum Lunas',s.belumLunas||0,ReceiptText,'warning'],['Total Tunggakan',formatRupiah(s.totalTunggakan||0),CircleDollarSign,'danger'],
  ['PPPoE Online',s.pppoeOnline||0,Network,'success'],['PPPoE Offline',s.pppoeOffline||0,WifiOff,'danger'],['Pembayaran Manual Menunggu',s.pembayaranManualMenunggu||0,CreditCard,'warning'],['Complain Baru',s.complainBaru||0,Headphones,'warning'],['Complain Aktif',s.complainAktif||0,Headphones,'warning'],['Teknisi Bertugas',s.teknisiBertugas||0,Wrench,'']
 ];
 const cols=[{header:'Pelanggan',accessor:r=><div><div className="table-title">{r.nama}</div><div className="table-sub">{r.id_pelanggan} · {r.wilayah}</div></div>},{header:'Jenis',accessor:'kategori'},{header:'Status',accessor:r=><Badge variant={statusVariant(r.status)}>{labelStatus(r.status)}</Badge>}];
 return <div className="page-container"><div className="page-header"><div><h1>{user?.role==='superadmin'?'Dashboard Super Admin':`Dashboard ${user?.wilayah}`}</h1><p>Ringkasan operasional Billing Life Media dan kondisi layanan hari ini.</p></div>{user?.role==='superadmin'&&<select className="form-control" style={{width:180}} value={wilayah} onChange={e=>setWilayah(e.target.value)}><option value="all">Semua Wilayah</option>{['BARAN','GUNUNGMANUK','NGASEMAYU','SALAM','TROSARI','WADUK'].map(w=><option key={w}>{w}</option>)}</select>}</div>
  <div className="stats-grid">{cards.map(([l,v,i,t])=><StatCard key={l} label={l} value={v} icon={i} tone={t}/>)}</div>
  <div className="two-col"><Card title="Ringkasan Pembayaran"><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}><div className="info-item"><div className="info-label">Tagihan Lunas</div><div className="info-value" style={{fontSize:24}}>{s.lunas||0}</div><div className="progress-track" style={{marginTop:8}}><div className="progress-bar" style={{width:`${s.totalTagihan?Math.round((s.lunas/s.totalTagihan)*100):0}%`,background:'var(--color-success)'}}/></div></div><div className="info-item"><div className="info-label">Total Pembayaran Bulan Ini</div><div className="info-value" style={{fontSize:24}}>{formatRupiah(s.totalPembayaran||0)}</div><div className="table-sub">Dari transaksi valid</div></div></div></Card>
  <Card title="Kondisi Jaringan"><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div className="info-item"><div className="info-label">Online</div><div className="info-value">{s.pppoeOnline||0} koneksi</div></div><div className="info-item"><div className="info-label">Offline</div><div className="info-value">{s.pppoeOffline||0} koneksi</div></div></div><div className="table-sub" style={{marginTop:12}}>Monitoring PPPoE membantu admin melihat kondisi koneksi pelanggan dan mendukung proses penanganan gangguan.</div></Card></div>
  <Card title="Complain Terbaru"><DataTable columns={cols} data={data?.recentComplaints||[]} emptyText="Belum ada complain aktif."/></Card>
 </div>;
}
