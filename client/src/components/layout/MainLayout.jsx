import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const SIDEBAR_STORAGE_KEY = 'cleon-sidebar-collapsed';

export default function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'; }
    catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try { window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); }
      catch { /* Sidebar still works when storage is unavailable. */ }
      return next;
    });
  };

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} />}
      <Sidebar open={mobileOpen} collapsed={sidebarCollapsed} onNavigate={() => setMobileOpen(false)} onToggleSidebar={toggleSidebar} />
      <main className="app-main">
        <Topbar onMenu={() => setMobileOpen((open) => !open)} mobileOpen={mobileOpen} />
        <div className="app-content"><Outlet /></div>
      </main>
    </div>
  );
}
