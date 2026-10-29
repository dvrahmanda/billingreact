import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, LocateFixed, MapPin, MapPinned, Navigation, RefreshCw, Search, Signal, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiGet } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Badge, { statusVariant } from '../../components/common/Badge';
import Button from '../../components/common/Button';

const REGIONS = ['BARAN', 'GUNUNGMANUK', 'NGASEMAYU', 'SALAM', 'TROSARI', 'WADUK'];
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
    script.onload = () => window.L?.map ? resolve(window.L) : reject(new Error('Peta gagal dimuat.'));
    script.onerror = () => reject(new Error('Peta tidak dapat dimuat. Periksa koneksi internet perangkat.'));
    document.head.appendChild(script);
  });
  return leafletLoader;
}

function escapeHtml(value) {
  return String(value ?? '-').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function hasCoordinates(technician) {
  const latitude = Number(technician.latitude);
  const longitude = Number(technician.longitude);
  return technician.latitude != null && technician.longitude != null
    && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function formatDate(value) {
  if (!value) return 'Belum ada update';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Waktu tidak diketahui' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function locationState(technician) {
  if (!hasCoordinates(technician) || !technician.location_updated_at) return { label: 'Belum ada GPS', tone: 'missing' };
  const ageMs = Date.now() - new Date(technician.location_updated_at).getTime();
  if (!Number.isFinite(ageMs) || ageMs > 2 * 60 * 1000) return { label: 'Lokasi lama', tone: 'stale' };
  return { label: 'Lokasi terbaru', tone: 'live' };
}

function markerIcon(L, technician, selected) {
  const state = locationState(technician);
  const initials = String(technician.nama || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const html = `<span class="tech-location-marker ${state.tone}${selected ? ' selected' : ''}"><span>${escapeHtml(initials)}</span></span>`;
  return L.divIcon({ className: 'tech-location-icon', html, iconSize: [40, 46], iconAnchor: [20, 42], popupAnchor: [0, -38] });
}

function popupContent(technician) {
  const state = locationState(technician);
  return `<div class="tech-location-popup"><strong>${escapeHtml(technician.nama)}</strong>
    <span>${escapeHtml(technician.wilayah_tugas)} · ${escapeHtml(technician.status)}</span>
    <span>${escapeHtml(state.label)} · ${escapeHtml(formatDate(technician.location_updated_at))}</span>
    ${technician.location_is_demo ? '<small>Koordinat contoh demo</small>' : ''}</div>`;
}

const activeStatuses = new Set(['ditugaskan', 'menuju_lokasi', 'dalam_penanganan', 'menunggu_material', 'terverifikasi']);

export default function TechnicianMonitoringPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [wilayah, setWilayah] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [mapError, setMapError] = useState('');
  const [leafletReady, setLeafletReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef(new Map());
  const firstViewportSet = useRef(false);

  const loadRows = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(''); }
    try {
      const query = new URLSearchParams();
      if (user?.role === 'superadmin') query.set('wilayah', wilayah);
      const queryString = query.toString();
      const result = await apiGet(`/technicians${queryString ? `?${queryString}` : ''}`);
      const nextRows = Array.isArray(result.data) ? result.data : [];
      setRows(nextRows);
      setSelectedId((current) => nextRows.some((row) => row.id === current) ? current : nextRows[0]?.id || null);
      setError('');
    } catch (requestError) {
      setError(requestError.friendlyMessage || 'Data teknisi gagal dimuat.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.role, wilayah]);

  useEffect(() => {
    loadRows();
    const timer = window.setInterval(() => loadRows(true), 15000);
    return () => window.clearInterval(timer);
  }, [loadRows, refreshKey]);

  useEffect(() => {
    let active = true;
    loadLeaflet().then(() => { if (active) setLeafletReady(true); })
      .catch((loadError) => { if (active) setMapError(loadError.message || 'Peta tidak dapat dimuat.'); });
    return () => { active = false; };
  }, []);

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

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => !query || [row.nama, row.nomor_whatsapp, row.wilayah_tugas, row.current_customer]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [rows, search]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    const L = window.L;
    layer.clearLayers();
    markersRef.current.clear();
    const bounds = [];
    visibleRows.forEach((technician) => {
      if (!hasCoordinates(technician)) return;
      const id = String(technician.id);
      const marker = L.marker([Number(technician.latitude), Number(technician.longitude)], {
        icon: markerIcon(L, technician, technician.id === selectedId), title: technician.nama,
      }).bindPopup(popupContent(technician), { maxWidth: 310 });
      marker.on('click', () => setSelectedId(technician.id));
      marker.addTo(layer);
      markersRef.current.set(id, marker);
      bounds.push([Number(technician.latitude), Number(technician.longitude)]);
    });
    if (!firstViewportSet.current && !loading && !error) {
      if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 15 });
      firstViewportSet.current = true;
    }
    window.requestAnimationFrame(() => map.invalidateSize());
  }, [visibleRows, selectedId, loading, error, leafletReady]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return undefined; }
    let active = true;
    const loadDetail = async (silent = false) => {
      if (!silent) { setDetailLoading(true); setDetailError(''); }
      try {
        const query = user?.role === 'superadmin' ? `?wilayah=${encodeURIComponent(wilayah)}` : '';
        const result = await apiGet(`/technicians/${selectedId}/monitoring${query}`);
        if (active) { setDetail(result.data || null); setDetailError(''); }
      } catch (requestError) {
        if (active) setDetailError(requestError.friendlyMessage || 'Detail kegiatan teknisi gagal dimuat.');
      } finally {
        if (active && !silent) setDetailLoading(false);
      }
    };
    loadDetail();
    const timer = window.setInterval(() => loadDetail(true), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedId, user?.role, wilayah, refreshKey]);

  const selected = rows.find((row) => row.id === selectedId) || null;
  const activeJobs = (detail?.tasks || []).filter((task) => activeStatuses.has(task.status));
  const liveCount = rows.filter((row) => locationState(row).tone === 'live').length;
  const mappedCount = rows.filter(hasCoordinates).length;
  const visibleMappedCount = visibleRows.filter(hasCoordinates).length;

  const focusTechnician = (technician) => {
    setSelectedId(technician.id);
    const marker = markersRef.current.get(String(technician.id));
    if (!marker || !mapRef.current) return;
    mapRef.current.setView(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 16), { animate: true });
    marker.openPopup();
  };

  return (
    <div className="page-container technician-monitoring-page">
      <div className="page-header">
        <div>
          <h1>Monitoring Teknisi</h1>
          <p>Lokasi terbaru dan riwayat progres pekerjaan teknisi diperbarui otomatis setiap 15 detik.</p>
        </div>
        <div className="technician-monitoring-actions">
          {user?.role === 'superadmin' && <select aria-label="Filter wilayah" className="form-control" value={wilayah} onChange={(event) => { setWilayah(event.target.value); setSelectedId(null); firstViewportSet.current = false; }}>
            <option value="all">Semua wilayah</option>{REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
          </select>}
          <Button variant="secondary" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={16} /> Muat ulang</Button>
        </div>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="technician-monitoring-stats">
        <div className="technician-monitoring-stat"><span><Wrench size={15} /> Teknisi</span><strong>{rows.length}</strong></div>
        <div className="technician-monitoring-stat"><span><Signal size={15} /> Lokasi terbaru</span><strong>{liveCount}</strong></div>
        <div className="technician-monitoring-stat"><span><MapPin size={15} /> Ada di peta</span><strong>{mappedCount}</strong></div>
        <div className="technician-monitoring-stat"><span><Navigation size={15} /> Sedang bertugas</span><strong>{rows.filter((row) => row.status === 'bertugas').length}</strong></div>
      </div>

      <div className="technician-monitoring-grid">
        <section className="card technician-monitoring-map-card">
          <div className="card-header"><strong><MapPinned size={17} /> Peta lokasi teknisi</strong><span className="technician-map-sync"><span /> Diperbarui tiap 15 detik</span></div>
          <div className="technician-monitoring-map-frame">
            <div ref={mapElement} className="technician-monitoring-map" aria-label="Peta lokasi teknisi" />
            {!leafletReady && !mapError && <div className="technician-map-overlay"><strong>Memuat peta</strong><span>Mohon tunggu sebentar.</span></div>}
            {mapError && <div className="technician-map-overlay error"><strong>Peta belum tersedia</strong><span>{mapError}</span></div>}
            {leafletReady && !loading && visibleMappedCount === 0 && !error && <div className="technician-map-overlay">
              <MapPin size={20} />
              <strong>{search ? 'Lokasi tidak ditemukan' : 'Belum ada lokasi GPS'}</strong>
              <span>{search ? 'Coba kata kunci atau wilayah lain.' : 'Teknisi perlu masuk ke aplikasi dan mengizinkan akses lokasi.'}</span>
            </div>}
          </div>
          <div className="technician-map-caption"><LocateFixed size={14} /> Lokasi dikirim dari aplikasi teknisi. Akurasi dan waktu pembaruan tersedia di detail.</div>
        </section>

        <div className="technician-monitoring-side">
          <section className="card technician-monitoring-list-card">
            <div className="card-header"><strong>Daftar teknisi ({visibleRows.length})</strong></div>
            <div className="technician-monitoring-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau wilayah..." /></div>
            <div className="technician-monitoring-list">
              {loading && !rows.length ? <div className="technician-monitoring-empty">Memuat teknisi...</div>
                : visibleRows.length ? visibleRows.map((technician) => {
                  const state = locationState(technician);
                  return <button type="button" key={technician.id} className={'technician-monitoring-row' + (technician.id === selectedId ? ' selected' : '')} onClick={() => focusTechnician(technician)}>
                    <span className={`technician-monitoring-avatar ${state.tone}`}>{String(technician.nama || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
                    <span className="technician-monitoring-row-main"><strong>{technician.nama}</strong><small>{technician.wilayah_tugas} · {technician.current_customer || 'Tidak ada pelanggan aktif'}</small><small>{state.label} · {formatDate(technician.location_updated_at)}</small></span>
                    <Badge variant={statusVariant(technician.status)}>{technician.status}</Badge>
                  </button>;
                }) : <div className="technician-monitoring-empty">Tidak ada teknisi yang cocok dengan pencarian.</div>}
            </div>
          </section>

          <section className="card technician-monitoring-detail-card">
            <div className="card-header"><strong>{selected ? `Detail ${selected.nama}` : 'Detail teknisi'}</strong>{selected && <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>}</div>
            {!selected ? <div className="technician-monitoring-empty">Pilih teknisi untuk melihat lokasi dan riwayat update.</div>
              : <div className="technician-monitoring-detail">
                {detailError && <div className="alert alert-danger" role="alert">{detailError}</div>}
                <div className="technician-location-summary">
                  <div className={`technician-location-state ${locationState(selected).tone}`}><MapPin size={16} /><span>{locationState(selected).label}</span></div>
                  {selected.location_is_demo && <Badge variant="warning">CONTOH DEMO</Badge>}
                  <small><Clock3 size={13} /> {formatDate(selected.location_updated_at)}</small>
                  {hasCoordinates(selected) ? <small>{Number(selected.latitude).toFixed(6)}, {Number(selected.longitude).toFixed(6)}{selected.accuracy_m != null ? ` · akurasi ±${Math.round(Number(selected.accuracy_m))} m` : ''}</small> : <small>Teknisi belum mengirim koordinat GPS.</small>}
                  {hasCoordinates(selected) && <a className="technician-map-link" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=17/${selected.latitude}/${selected.longitude}`}>Buka titik di OpenStreetMap</a>}
                </div>

                <div className="technician-detail-section"><strong>Tugas aktif ({activeJobs.length})</strong>
                  {detailLoading && !detail ? <small>Memuat detail...</small> : activeJobs.length ? activeJobs.map((task) => <div className="technician-task-summary" key={task.id}>
                    <div><strong>{task.nomor_tiket}</strong><small>{task.nama_pelanggan} · {task.wilayah}</small></div><Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                    <Link to={`/complaints/${task.id}`}>Buka tiket</Link>
                  </div>) : <small>Tidak ada tugas aktif saat ini.</small>}
                </div>

                <div className="technician-detail-section"><strong>Riwayat kegiatan & update</strong>
                  {detail?.activity?.length ? <div className="technician-activity-list">{detail.activity.map((event) => <article className="technician-activity-item" key={event.id}>
                    <span className="technician-activity-dot" />
                    <div><div className="technician-activity-title"><strong>{event.judul || event.status}</strong><Badge variant={statusVariant(event.status)}>{event.status}</Badge></div>
                      <small>{formatDate(event.created_at)} · {event.aktor_nama || selected.nama}</small>
                      <small>{event.nomor_tiket} · {event.nama_pelanggan} · {event.wilayah}</small>
                      {event.keterangan && <p>{event.keterangan}</p>}
                    </div>
                  </article>)}</div> : <small>{detailLoading ? 'Memuat riwayat...' : 'Belum ada update pekerjaan dari teknisi.'}</small>}
                </div>
              </div>}
          </section>
        </div>
      </div>
    </div>
  );
}
