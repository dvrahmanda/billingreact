import React, { useEffect, useState } from 'react';
import { apiGet, apiPut } from '../../services/api';
import Button from '../../components/common/Button';

const regions = ['BARAN', 'GUNUNGMANUK', 'NGASEMAYU', 'SALAM', 'TROSARI', 'WADUK'];
const blank = (wilayah) => ({ wilayah, nama_layanan: `Life Media ${wilayah}`, nomor_whatsapp: '', catatan_pembayaran: '', metode_pembayaran: [] });

export default function RegionSettingsPage() {
  const [configs, setConfigs] = useState([]);
  const [wilayah, setWilayah] = useState('SALAM');
  const [form, setForm] = useState(blank('SALAM'));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { const response = await apiGet('/admins/settings/regions'); setConfigs(response.data || []); }
    catch (requestError) { setError(requestError.friendlyMessage || 'Pengaturan wilayah gagal dimuat.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setForm(configs.find((item) => item.wilayah === wilayah) || blank(wilayah)); }, [configs, wilayah]);

  const setMethod = (index, key, value) => setForm((current) => ({ ...current, metode_pembayaran: current.metode_pembayaran.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const save = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await apiPut(`/admins/settings/regions/${encodeURIComponent(wilayah)}`, form);
      setConfigs((current) => [...current.filter((item) => item.wilayah !== wilayah), response.data]);
      setNotice(`Pengaturan ${wilayah} berhasil disimpan.`);
    } catch (requestError) { setError(requestError.friendlyMessage || 'Pengaturan gagal disimpan.'); }
    finally { setBusy(false); }
  };

  return <div className="page-container">
    <div className="page-header"><div><h1>Pengaturan Layanan Wilayah</h1><p>Atur identitas layanan, kontak WhatsApp, instruksi pembayaran, dan rekening untuk setiap wilayah.</p></div></div>
    {error && <div className="alert alert-danger">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}
    <div className="card"><div className="card-body">
      <div className="form-grid">
        <div className="form-group"><label className="form-label">Wilayah</label><select className="form-control" value={wilayah} onChange={(event) => { setWilayah(event.target.value); setNotice(''); }}>{regions.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Nama Layanan</label><input className="form-control" maxLength={150} value={form.nama_layanan || ''} onChange={(event) => setForm({ ...form, nama_layanan: event.target.value })} /></div>
        <div className="form-group"><label className="form-label">Nomor WhatsApp</label><input className="form-control" maxLength={30} value={form.nomor_whatsapp || ''} onChange={(event) => setForm({ ...form, nomor_whatsapp: event.target.value })} placeholder="Contoh: 62812..." /></div>
        <div className="form-group"><label className="form-label">Catatan / Instruksi Pembayaran</label><textarea className="form-control" rows={4} maxLength={5000} value={form.catatan_pembayaran || ''} onChange={(event) => setForm({ ...form, catatan_pembayaran: event.target.value })} placeholder="Masukkan petunjuk pembayaran untuk pelanggan" /></div>
      </div>
      <div className="page-header" style={{ marginTop: 20 }}><div><h2>Metode Pembayaran</h2><p>Rekening dan e-wallet ini akan ditampilkan di aplikasi pelanggan wilayah {wilayah}.</p></div><Button variant="outline" onClick={() => setForm({ ...form, metode_pembayaran: [...(form.metode_pembayaran || []), { jenis: 'bank', nama: '', nomor: '', atas_nama: '' }] })}>Tambah Metode</Button></div>
      {!form.metode_pembayaran?.length && <div className="empty-state">Belum ada rekening atau e-wallet untuk wilayah ini.</div>}
      {(form.metode_pembayaran || []).map((method, index) => <div className="card" key={index} style={{ marginTop: 12 }}><div className="card-body"><div className="form-grid">
        <div className="form-group"><label className="form-label">Jenis</label><select className="form-control" value={method.jenis} onChange={(event) => setMethod(index, 'jenis', event.target.value)}><option value="bank">Bank</option><option value="ewallet">E-Wallet</option></select></div>
        <div className="form-group"><label className="form-label">Nama Bank / E-Wallet</label><input className="form-control" maxLength={80} value={method.nama} onChange={(event) => setMethod(index, 'nama', event.target.value)} placeholder="Nama penyedia" /></div>
        <div className="form-group"><label className="form-label">Nomor Rekening / Akun</label><input className="form-control" maxLength={80} value={method.nomor} onChange={(event) => setMethod(index, 'nomor', event.target.value)} /></div>
        <div className="form-group"><label className="form-label">Atas Nama</label><input className="form-control" maxLength={120} value={method.atas_nama} onChange={(event) => setMethod(index, 'atas_nama', event.target.value)} /></div>
      </div><div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><Button variant="danger" size="sm" onClick={() => setForm({ ...form, metode_pembayaran: form.metode_pembayaran.filter((_item, i) => i !== index) })}>Hapus</Button></div></div></div>)}
      <div className="header-actions" style={{ justifyContent: 'flex-end', marginTop: 20 }}><Button onClick={save} disabled={busy || loading}>{busy ? 'Menyimpan...' : 'Simpan Pengaturan'}</Button></div>
    </div></div>
    {loading && <div className="table-sub" style={{ marginTop: 10 }}>Memuat pengaturan wilayah...</div>}
  </div>;
}
