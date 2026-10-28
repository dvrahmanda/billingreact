import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Users, ReceiptText, CreditCard, Network, Link2, MapPinned, Headphones, Wrench, FileBarChart, ChartNoAxesCombined, ShieldCheck, Activity, LogOut, CheckCheck, Settings2 } from 'lucide-react';

const Item=({to,icon:Icon,label,onClick})=><NavLink onClick={onClick} to={to} className={({isActive})=>`nav-item ${isActive?'active':''}`}><Icon size={16}/><span>{label}</span></NavLink>;
export default function Sidebar({open,onNavigate}) {
  const {user,logout}=useAuth(); const isSuper=user?.role==='superadmin';
  return <aside className={`app-sidebar ${open?'open':''}`}>
    <div className="sidebar-brand"><div className="brand-row"><div className="brand-mark">LM</div><div><div className="brand-title">Life Media</div><div className="brand-subtitle">Billing Internet</div></div></div>
      <span className="role-chip">{isSuper?'SUPER ADMIN':`ADMIN ${user?.wilayah||''}`}</span></div>
    <nav className="sidebar-nav">
      <div className="nav-section-title">UTAMA</div><Item to="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={onNavigate}/>
      <div className="nav-section-title">BILLING & PELANGGAN</div><Item to="/customers" icon={Users} label="Data Pelanggan" onClick={onNavigate}/><Item to="/billings" icon={ReceiptText} label="Daftar Tagihan" onClick={onNavigate}/><Item to="/payments" icon={CreditCard} label="Riwayat Pembayaran" onClick={onNavigate}/><Item to="/payments/manual" icon={CheckCheck} label="Verifikasi Manual" onClick={onNavigate}/><Item to="/payments/matching" icon={CheckCheck} label="Pengecekan Pembayaran" onClick={onNavigate}/>
      <div className="nav-section-title">JARINGAN PPPoE</div><Item to="/network/monitoring" icon={Network} label="Monitoring PPPoE" onClick={onNavigate}/><Item to="/network/mapping" icon={Link2} label="Mapping PPPoE" onClick={onNavigate}/><Item to="/network/map" icon={MapPinned} label="Peta Persebaran" onClick={onNavigate}/>
      <div className="nav-section-title">LAYANAN GANGGUAN</div><Item to="/complaints" icon={Headphones} label="Complain Pelanggan" onClick={onNavigate}/><Item to="/technicians/monitoring" icon={Wrench} label="Monitoring Teknisi" onClick={onNavigate}/>
      <div className="nav-section-title">LAPORAN & ANALISIS</div><Item to="/reports/financial" icon={FileBarChart} label="Laporan Keuangan" onClick={onNavigate}/><Item to="/analytics" icon={ChartNoAxesCombined} label="Analitik" onClick={onNavigate}/>
      {isSuper&&<><div className="nav-section-title">MANAJEMEN SISTEM</div><Item to="/management/admins" icon={ShieldCheck} label="Admin Wilayah" onClick={onNavigate}/><Item to="/management/region-settings" icon={Settings2} label="Pengaturan Wilayah" onClick={onNavigate}/><Item to="/management/technicians" icon={Wrench} label="Data Teknisi" onClick={onNavigate}/><Item to="/activity" icon={Activity} label="Activity Log" onClick={onNavigate}/></>}
    </nav>
    <div className="sidebar-footer"><button className="logout-button" onClick={logout}><LogOut size={16}/>Keluar</button></div>
  </aside>;
}
