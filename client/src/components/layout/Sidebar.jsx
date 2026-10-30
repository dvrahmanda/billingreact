import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatWilayahName } from '../../utils/formatters';
import {
  Activity,
  Bell,
  ChartNoAxesCombined,
  CheckCheck,
  ChevronDown,
  CreditCard,
  FileBarChart,
  Headphones,
  LayoutDashboard,
  Link2,
  MapPinned,
  Network,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const Item = ({ to, icon: Icon, label, onClick, end = false, sub = false }) => (
  <NavLink
    end={end}
    onClick={onClick}
    to={to}
    aria-label={label}
    title={label}
    className={({ isActive }) => 'nav-item' + (sub ? ' nav-subitem' : '') + (isActive ? ' active' : '')}
  >
    <Icon size={sub ? 14 : 16} />
    <span>{label}</span>
  </NavLink>
);

const isWithin = (pathname, target) => pathname === target || pathname.startsWith(target + '/');

export default function Sidebar({ open, collapsed, onNavigate, onToggleSidebar }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isSuper = user?.role === 'superadmin';
  const isRelawan = user?.role === 'relawan';

  const groups = [
    {
      id: 'billing',
      label: 'Pelanggan & Tagihan',
      icon: Users,
      items: [
        { to: '/customers', icon: Users, label: 'Data Pelanggan' },
        { to: '/billings', icon: ReceiptText, label: 'Daftar Tagihan' },
      ],
    },
    {
      id: 'payments',
      label: 'Pembayaran',
      icon: CreditCard,
      items: [
        { to: '/payments', icon: CreditCard, label: 'Riwayat Pembayaran', end: true },
        ...(!isRelawan ? [{ to: '/payments/matching', icon: CheckCheck, label: 'Pencocokan Pembayaran' }] : []),
      ],
    },
    {
      id: 'network',
      label: 'Jaringan PPPoE',
      icon: Network,
      items: [
        { to: '/network/monitoring', icon: Network, label: 'Monitoring PPPoE' },
        { to: '/network/mapping', icon: Link2, label: 'Mapping PPPoE' },
        { to: '/network/map', icon: MapPinned, label: 'Peta PPPoE' },
      ],
    },
    {
      id: 'service',
      label: 'Gangguan & Teknisi',
      icon: Headphones,
      items: [
        { to: '/complaints', icon: Headphones, label: 'Complain Pelanggan' },
        { to: '/technicians/monitoring', icon: Wrench, label: 'Monitoring Teknisi' },
      ],
    },
    {
      id: 'reports',
      label: 'Laporan & Analisis',
      icon: FileBarChart,
      items: [
        { to: '/reports/financial', icon: FileBarChart, label: 'Laporan Keuangan' },
        { to: '/analytics', icon: ChartNoAxesCombined, label: 'Analitik' },
      ],
    },
  ];

  if (isSuper || user?.role === 'admin') {
    groups.push({
      id: 'system',
      label: 'Manajemen Sistem',
      icon: Settings2,
      items: [
        { to: '/management/admins', icon: ShieldCheck, label: 'Admin per Wilayah' },
        ...(isSuper ? [
          { to: '/management/technicians', icon: Wrench, label: 'Data Teknisi' },
          { to: '/activity', icon: Activity, label: 'Activity Log' },
        ] : []),
      ],
    });
  }

  const visibleGroups = isRelawan ? groups.filter((group) => ['billing', 'payments'].includes(group.id)) : groups;
  const activeGroup = visibleGroups.find((group) => group.items.some((item) => isWithin(location.pathname, item.to)))?.id || null;
  const [expandedGroup, setExpandedGroup] = useState(activeGroup);

  useEffect(() => {
    setExpandedGroup(activeGroup);
  }, [activeGroup]);

  return (
    <aside className={'app-sidebar' + (open ? ' open' : '')}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-top">
          <img className="brand-logo" src="/cleon-logo.png" alt="CLEON Internet Access" />
          <button type="button" className="sidebar-collapse-button" onClick={onToggleSidebar} aria-label={collapsed ? 'Tampilkan menu penuh' : 'Ciutkan sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Tampilkan menu penuh' : 'Ciutkan sidebar'}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <span className="role-chip">{isSuper ? 'SUPER ADMIN' : isRelawan ? `ADMIN ${formatWilayahName(user?.wilayah).toUpperCase()}` : `ADMIN WILAYAH ${formatWilayahName(user?.wilayah).toUpperCase()}`}</span>
      </div>

      <nav className="sidebar-nav" aria-label="Navigasi utama">
        <div className="nav-section-title">MENU</div>
        <Item to="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={onNavigate} end />

        {visibleGroups.map((group) => {
          const Icon = group.icon;
          const expanded = expandedGroup === group.id;
          const active = activeGroup === group.id;
          const panelId = 'nav-group-' + group.id;
          return (
            <div className="nav-group" key={group.id}>
              <button
                type="button"
                className={'nav-group-trigger' + (active ? ' active' : '') + (expanded ? ' expanded' : '')}
                aria-expanded={expanded}
                aria-label={group.label}
                title={group.label}
                aria-controls={panelId}
                onClick={() => setExpandedGroup((current) => current === group.id ? null : group.id)}
              >
                <Icon size={16} />
                <span>{group.label}</span>
                <ChevronDown size={14} className="nav-group-chevron" />
              </button>
              {expanded && (
                <div className="nav-subitems" id={panelId}>
                  {group.items.map((item) => <Item key={item.to} {...item} sub onClick={onNavigate} />)}
                </div>
              )}
            </div>
          );
        })}

        <Item to="/notifications" icon={Bell} label="Notifikasi" onClick={onNavigate} />
      </nav>

      <div className="sidebar-footer">
        <button className="logout-button" onClick={logout} aria-label="Keluar" title="Keluar"><LogOut size={16} /><span>Keluar</span></button>
      </div>
    </aside>
  );
}
