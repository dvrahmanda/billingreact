import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPinned, Network, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import { apiGet } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Badge, { statusVariant } from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import StatCard from '../../components/common/StatCard';

const REGIONS = ['BARAN', 'GUNUNGMANUK', 'NGASEMAYU', 'SALAM', 'TROSARI', 'WADUK'];
const EMPTY_COUNTS = { total: 0, mapped: 0, without_coordinates: 0, online: 0, offline: 0 };
const PAGE_SIZE = 25;
const LEAFLET_VERSION = '1.9.4';
let leafletLoader;

function loadLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  if (leafletLoader) return leafletLoader;
  leafletLoader = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-cleon-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
      link.dataset.cleonLeaflet = 'true';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
    script.async = true;
    script.dataset.cleonLeaflet = 'true';
    script.onload = () => window.L?.map ? resolve(window.L) : reject(new Error('Leaflet gagal dimuat.'));
    script.onerror = () => reject(new Error('Peta Leaflet tidak dapat dimuat. Periksa koneksi internet perangkat.'));
    document.head.appendChild(script);
  });
  return leafletLoader;
}

function escapeHtml(value) {
  return String(value ?? '-').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function accountKey(row, fallback = '') {
  const username = String(row.username || row.user || '').trim().toLowerCase();
  return username ? `username:${username}` : `id:${String(row.id || fallback)}`;
}

function markerPopup(row) {
  const status = String(row.status || 'UNKNOWN').toUpperCase();
  const tone = status === 'ONLINE' ? 'online' : status === 'OFFLINE' ? 'offline' : 'unknown';
  return `<div class="pppoe-popup">
    <strong>${escapeHtml(row.username || row.nama || 'Akun PPPoE')}</strong>
    <span class="pppoe-popup-status ${tone}">${escapeHtml(status)}</span>
    <div><b>Lokasi</b><span>${escapeHtml(row.lokasi || row.wilayah)}</span></div>
    <div><b>IP</b><span>${escapeHtml(row.ip)}</span></div>
    <div><b>Router</b><span>${escapeHtml(row.router)}</span></div>
    <div><b>Koordinat</b><span>${Number(row.latitude).toFixed(6)}, ${Number(row.longitude).toFixed(6)}</span></div>
    <div><b>Uptime</b><span>${escapeHtml(row.uptime)}</span></div>
  </div>`;
}

function markerIcon(L, status) {
  const normalized = String(status || 'UNKNOWN').toUpperCase();
  const tone = normalized === 'ONLINE' ? 'online' : normalized === 'OFFLINE' ? 'offline' : 'unknown';
  const html = `<span class="pppoe-leaflet-marker ${tone}" aria-label="${tone}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 8.8a14.8 14.8 0 0 1 19 0M5.8 12a9.6 9.6 0 0 1 12.4 0m-9.1 3.2a4.4 4.4 0 0 1 5.8 0M12 19h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.5"/></svg></span>`;
  return L.divIcon({ className: 'pppoe-leaflet-icon', html, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -15] });
}

export default function CustomerGeoMapPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [wilayah, setWilayah] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [leafletReady, setLeafletReady] = useState(false);
  const [leafletError, setLeafletError] = useState('');
  const mapElement = useRef(null);
  const pointListRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef(new Map());
  const firstViewportSet = useRef(false);

  useEffect(() => {
    let mounted = true;
    loadLeaflet().then(() => {
      if (mounted) setLeafletReady(true);
    }).catch((loadError) => {
      if (mounted) setLeafletError(loadError.message || 'Peta tidak dapat dimuat.');
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const result = await apiGet(`/pppoe/readonly/map?wilayah=${encodeURIComponent(wilayah)}`);
        if (!active) return;
        setRows(Array.isArray(result.data) ? result.data : []);
        setCounts({ ...EMPTY_COUNTS, ...(result.counts || {}) });
        setFetchedAt(result.fetched_at || new Date().toISOString());
        setError('');
      } catch (requestError) {
        if (!active) return;
        setError(requestError.friendlyMessage || 'Data PPPoE gagal dimuat dari website monitoring.');
      } finally {
        if (active && !silent) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(() => load(true), 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [wilayah, refreshKey]);

  useEffect(() => {
    setPage(1);
    firstViewportSet.current = false;
  }, [wilayah]);

  useEffect(() => setPage(1), [search, statusFilter]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = String(row.status || 'UNKNOWN').toUpperCase();
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!query) return true;
      return [row.username, row.nama, row.customer_name, row.lokasi, row.wilayah, row.ip, row.router]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [rows, search, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageRows = visibleRows.slice(pageStart, pageStart + PAGE_SIZE);
  const pageEnd = pageStart + pageRows.length;

  useEffect(() => setPage((value) => Math.min(value, totalPages)), [totalPages]);
  useEffect(() => {
    if (pointListRef.current) pointListRef.current.scrollTop = 0;
  }, [page]);

  useEffect(() => {
    if (!leafletReady || !mapElement.current || mapRef.current) return undefined;
    const L = window.L;
    const map = L.map(mapElement.current, { preferCanvas: true, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    map.setView([-7.85, 110.48], 11);
    mapRef.current = map;
    layerRef.current = layer;
    window.requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
    };
  }, [leafletReady]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    const L = window.L;
    layer.clearLayers();
    markersRef.current.clear();
    const bounds = [];
    visibleRows.forEach((row, index) => {
      const latitude = Number(row.latitude ?? row.koordinat_y);
      const longitude = Number(row.longitude ?? row.koordinat_x);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
        || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return;
      const point = [latitude, longitude];
      const marker = L.marker(point, {
        icon: markerIcon(L, row.status),
        title: row.username || row.nama || 'Akun PPPoE',
      }).bindPopup(markerPopup({ ...row, latitude, longitude }), { maxWidth: 320 });
      marker.addTo(layer);
      markersRef.current.set(accountKey(row, index), marker);
      bounds.push(point);
    });
    if (!firstViewportSet.current && !loading && !error) {
      if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 15 });
      else map.setView([-7.85, 110.48], 11);
      firstViewportSet.current = true;
    }
    window.requestAnimationFrame(() => map.invalidateSize());
  }, [visibleRows, loading, error, leafletReady]);

  const focusPoint = (row) => {
    const map = mapRef.current;
    const marker = markersRef.current.get(accountKey(row));
    if (!map || !marker) return;
    const point = marker.getLatLng();
    map.setView(point, Math.max(map.getZoom(), 16), { animate: true });
    marker.openPopup();
  };

  return (
    <div className="page-container pppoe-distribution-page">
      <div className="page-header">
        <div>
          <h1>Peta Persebaran PPPoE</h1>
          <p>Lokasi dan status dibaca langsung dari website monitoring PPPoE. Tampilan ini hanya-baca.</p>
          {fetchedAt && <div className="table-sub">Data sumber diperbarui {new Date(fetchedAt).toLocaleTimeString('id-ID')}</div>}
        </div>
        <div className="pppoe-map-header-actions">
          <Badge variant="info">READ ONLY</Badge>
          {user?.role === 'superadmin' && (
            <select aria-label="Filter wilayah" className="form-control" value={wilayah} onChange={(event) => setWilayah(event.target.value)}>
              <option value="all">Semua Wilayah</option>
              {REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          )}
          <Button variant="secondary" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>
            <RefreshCw size={16} /> Muat ulang
          </Button>
        </div>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="stats-grid">
        <StatCard label="Total PPPoE" value={Number(counts.total).toLocaleString('id-ID')} icon={Network} />
        <StatCard label="Titik di peta" value={Number(counts.mapped).toLocaleString('id-ID')} icon={MapPinned} />
        <StatCard label="Online" value={Number(counts.online).toLocaleString('id-ID')} icon={Wifi} tone="success" />
        <StatCard label="Offline" value={Number(counts.offline).toLocaleString('id-ID')} icon={WifiOff} tone="danger" />
      </div>

      {counts.without_coordinates > 0 && (
        <div className="alert" style={{ background: 'var(--color-highlight)', color: '#6a572f' }}>
          {Number(counts.without_coordinates).toLocaleString('id-ID')} akun PPPoE belum memiliki koordinat dari sumber monitoring, jadi tidak muncul sebagai marker.
        </div>
      )}

      <div className="filter-bar pppoe-distribution-filterbar">
        <label className="pppoe-distribution-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari username, pelanggan, IP, router..." /></label>
        <select className="form-control" aria-label="Filter status PPPoE" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Semua status</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="UNKNOWN">Tidak diketahui</option>
        </select>
        <span className="pppoe-filter-count">{visibleRows.length.toLocaleString('id-ID')} titik cocok</span>
      </div>

      <div className="two-col pppoe-distribution-grid">
        <Card title={`Peta PPPoE (${visibleRows.length.toLocaleString('id-ID')})`} className="pppoe-distribution-map-card">
          <div className="pppoe-distribution-map-frame">
            <div ref={mapElement} className="pppoe-leaflet-map" aria-label="Peta persebaran titik PPPoE" />
            {!leafletReady && !leafletError && <div className="pppoe-map-overlay">Memuat peta...</div>}
            {leafletError && <div className="pppoe-map-overlay error">{leafletError}</div>}
            {leafletReady && !loading && visibleRows.length === 0 && !error && (
              <div className="pppoe-map-empty">{search || statusFilter !== 'all' ? 'Tidak ada titik yang cocok dengan filter.' : 'Sumber monitoring belum mengirim koordinat PPPoE.'}</div>
            )}
          </div>
        </Card>

        <Card title={`Titik PPPoE (${visibleRows.length.toLocaleString('id-ID')})`} className="pppoe-distribution-list-card">
          {loading && !rows.length ? (
            <div className="screen-center" style={{ minHeight: 180 }}><div className="spinner" /></div>
          ) : pageRows.length ? (
            <>
              <div ref={pointListRef} className="pppoe-distribution-point-list">
                {pageRows.map((row, index) => (
                  <button type="button" key={accountKey(row, index)} className="pppoe-distribution-point" onClick={() => focusPoint(row)}>
                    <span className="map-customer-number">{pageStart + index + 1}</span>
                    <span className="pppoe-distribution-point-copy">
                      <strong>{row.username || row.nama || 'Akun PPPoE'}</strong>
                      <span>{row.customer_name ? `Pelanggan: ${row.customer_name} | ` : ''}{row.lokasi || row.wilayah || 'Lokasi tidak diketahui'}</span>
                      <span>IP {row.ip || '-'} | Router {row.router || '-'}</span>
                      <span>{Number(row.latitude).toFixed(5)}, {Number(row.longitude).toFixed(5)} | Uptime {row.uptime || '-'}</span>
                    </span>
                    <Badge variant={statusVariant(row.status)}>{row.status || 'UNKNOWN'}</Badge>
                  </button>
                ))}
              </div>
              {visibleRows.length > PAGE_SIZE && (
                <div className="pppoe-distribution-pagination">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</Button>
                  <span>Data { (pageStart + 1).toLocaleString('id-ID') }–{pageEnd.toLocaleString('id-ID')} dari {visibleRows.length.toLocaleString('id-ID')} · Halaman {page}/{totalPages}</span>
                  <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Berikutnya</Button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state"><strong>{error ? 'Data monitoring belum tersedia' : 'Belum ada titik untuk ditampilkan'}</strong>{error || 'Coba ubah pencarian/filter atau periksa koordinat pada website monitoring.'}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
