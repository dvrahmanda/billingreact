import React, { useEffect, useState } from 'react';
import { apiGet, apiPut } from '../../services/api';
import Button from '../../components/common/Button';

const regions = ['BARAN', 'GUNUNGMANUK', 'NGASEMAYU', 'SALAM', 'TROSARI', 'WADUK'];
const blank = (wilayah) => ({ wilayah, nama_layanan: 'Life Media ' + wilayah, nomor_whatsapp: '' });

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
    try {
      const response = await apiGet('/admins/settings/regions');
      setConfigs(response.data || []);
    } catch (requestError) {
      setError(requestError.friendlyMessage || 'Pengaturan wilayah gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const selected = configs.find((item) => item.wilayah === wilayah);
    setForm(selected ? { wilayah, nama_layanan: selected.nama_layanan || '', nomor_whatsapp: selected.nomor_whatsapp || '' } : blank(wilayah));
  }, [configs, wilayah]);

  const save = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = { nama_layanan: form.nama_layanan, nomor_whatsapp: form.nomor_whatsapp };
      const response = await apiPut('/admins/settings/regions/' + encodeURIComponent(wilayah), payload);
      setConfigs((current) => [...current.filter((item) => item.wilayah !== wilayah), response.data]);
      setNotice('Pengaturan ' + wilayah + ' berhasil disimpan.');
    } catch (requestError) {
      setError(requestError.friendlyMessage || 'Pengaturan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="page-container">
    <div className="page-header">
      <div><h1>Pengaturan Layanan Wilayah</h1><p>Atur identitas layanan dan kontak WhatsApp untuk setiap wilayah.</p></div>
    </div>
    {error && <div className="alert alert-danger">{error}</div>}
    {notice && <div className="alert alert-success">{notice}</div>}
    <div className="card"><div className="card-body">
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Wilayah</label>
          <select className="form-control" value={wilayah} onChange={(event) => { setWilayah(event.target.value); setNotice(''); }}>
            {regions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Nama Layanan</label>
          <input className="form-control" maxLength={150} value={form.nama_layanan || ''} onChange={(event) => setForm({ ...form, nama_layanan: event.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Nomor WhatsApp</label>
          <input className="form-control" maxLength={30} value={form.nomor_whatsapp || ''} onChange={(event) => setForm({ ...form, nomor_whatsapp: event.target.value })} placeholder="Contoh: 62812..." />
        </div>
      </div>
      <div className="alert" style={{ marginTop: 16, background: 'var(--color-secondary-light)', color: 'var(--color-primary)' }}>
        Semua pembayaran pelanggan diproses melalui Midtrans.
      </div>
      <div className="header-actions" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
        <Button onClick={save} disabled={busy || loading}>{busy ? 'Menyimpan...' : 'Simpan Pengaturan'}</Button>
      </div>
    </div></div>
    {loading && <div className="table-sub" style={{ marginTop: 10 }}>Memuat pengaturan wilayah...</div>}
  </div>;
}