const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { demo, isDemo } = require('../utils/helpers');
const { WILAYAH_RESMI } = require('../config/constants');

const emptyRegionConfig = (wilayah) => ({ wilayah, nama_layanan: `Life Media ${wilayah}`, nomor_whatsapp: '', catatan_pembayaran: '', metode_pembayaran: [] });

exports.regionSettings = async (_req, res, next) => {
  try {
    if (isDemo()) {
      const saved = demo.regionConfigs || [];
      return res.json({ success: true, data: WILAYAH_RESMI.map((wilayah) => saved.find((item) => item.wilayah === wilayah) || emptyRegionConfig(wilayah)) });
    }
    const [configs] = await db.query('SELECT * FROM wilayah_configs ORDER BY wilayah');
    const [methods] = await db.query('SELECT m.* FROM wilayah_payment_methods m JOIN wilayah_configs c ON c.id=m.wilayah_config_id ORDER BY m.id');
    const data = WILAYAH_RESMI.map((wilayah) => {
      const config = configs.find((item) => item.wilayah === wilayah);
      return config
        ? { ...config, metode_pembayaran: methods.filter((item) => item.wilayah_config_id === config.id).map(({ id, wilayah_config_id, ...method }) => method) }
        : emptyRegionConfig(wilayah);
    });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
};

exports.saveRegionSettings = async (req, res, next) => {
  const wilayah = String(req.params.wilayah || '').trim().toUpperCase();
  const nama = String(req.body.nama_layanan || '').trim();
  const whatsapp = String(req.body.nomor_whatsapp || '').trim();
  const notes = String(req.body.catatan_pembayaran || '').trim();
  const methods = req.body.metode_pembayaran;
  if (!WILAYAH_RESMI.includes(wilayah) || !nama || nama.length > 150 || whatsapp.length > 30 || notes.length > 5000 || !Array.isArray(methods) || methods.length > 20) {
    return res.status(400).json({ success: false, message: 'Pengaturan wilayah tidak valid.' });
  }
  const normalizedMethods = [];
  for (const item of methods) {
    const jenis = String(item.jenis || '').trim().toLowerCase();
    const method = { jenis, nama: String(item.nama || '').trim(), nomor: String(item.nomor || '').trim(), atas_nama: String(item.atas_nama || '').trim() };
    if (!['bank', 'ewallet'].includes(jenis) || !method.nama || !method.nomor || !method.atas_nama || method.nama.length > 80 || method.nomor.length > 80 || method.atas_nama.length > 120) {
      return res.status(400).json({ success: false, message: 'Setiap metode harus memiliki jenis, nama, nomor, dan nama pemilik yang valid.' });
    }
    normalizedMethods.push(method);
  }
  try {
    const saved = { wilayah, nama_layanan: nama, nomor_whatsapp: whatsapp, catatan_pembayaran: notes, metode_pembayaran: normalizedMethods };
    if (isDemo()) {
      demo.regionConfigs ||= [];
      const index = demo.regionConfigs.findIndex((item) => item.wilayah === wilayah);
      if (index >= 0) demo.regionConfigs[index] = saved; else demo.regionConfigs.push(saved);
      return res.json({ success: true, data: saved });
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        'INSERT INTO wilayah_configs (wilayah,nama_layanan,nomor_whatsapp,catatan_pembayaran) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE nama_layanan=VALUES(nama_layanan),nomor_whatsapp=VALUES(nomor_whatsapp),catatan_pembayaran=VALUES(catatan_pembayaran)',
        [wilayah, nama, whatsapp || null, notes || null],
      );
      const [[config]] = await connection.query('SELECT id FROM wilayah_configs WHERE wilayah=? FOR UPDATE', [wilayah]);
      await connection.query('DELETE FROM wilayah_payment_methods WHERE wilayah_config_id=?', [config.id]);
      for (const method of normalizedMethods) {
        await connection.query('INSERT INTO wilayah_payment_methods (wilayah_config_id,jenis,nama,nomor,atas_nama) VALUES (?,?,?,?,?)', [config.id, method.jenis, method.nama, method.nomor, method.atas_nama]);
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    return res.json({ success: true, data: saved });
  } catch (error) { return next(error); }
};

exports.list = async (_req, res, next) => {
  try {
    if (isDemo()) return res.json({ success: true, data: demo.users.filter((user) => user.role === 'admin').map(({ password, ...user }) => user) });
    const [rows] = await db.query("SELECT id,username,role,wilayah,nama_lengkap,nomor_telepon,status,created_at FROM users WHERE role='admin' ORDER BY wilayah");
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim(); const name = String(req.body.nama_lengkap || '').trim();
    const region = String(req.body.wilayah || '').toUpperCase(); const password = String(req.body.password || '');
    if (!username || !name || password.length < 8 || !WILAYAH_RESMI.includes(region)) return res.status(400).json({ success: false, message: 'Nama, username, wilayah valid, dan password minimal 8 karakter wajib diisi.' });
    if (isDemo()) {
      if (demo.users.some((user) => user.username === username)) return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
      const user = { id: Math.max(0, ...demo.users.map((item) => item.id)) + 1, username, password, role: 'admin', wilayah: region, nama_lengkap: name, nomor_telepon: req.body.nomor_telepon || null, status: 'aktif' };
      demo.users.push(user);
      const { password: _password, ...safe } = user;
      return res.status(201).json({ success: true, data: safe });
    }
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query("INSERT INTO users (username,password,role,wilayah,nama_lengkap,nomor_telepon,status) VALUES (?,?,'admin',?,?,?,'aktif')", [username, hash, region, name, req.body.nomor_telepon || null]);
    return res.status(201).json({ success: true, data: { id: result.insertId, username, role: 'admin', wilayah: region, nama_lengkap: name, status: 'aktif' } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id); const name = String(req.body.nama_lengkap || '').trim();
    const region = String(req.body.wilayah || '').toUpperCase(); const phone = String(req.body.nomor_telepon || '').trim();
    const status = String(req.body.status || 'aktif'); const password = String(req.body.password || '');
    if (!name || !WILAYAH_RESMI.includes(region) || !['aktif', 'nonaktif'].includes(status) || (password && password.length < 8)) return res.status(400).json({ success: false, message: 'Data admin tidak valid.' });
    if (isDemo()) {
      const user = demo.users.find((item) => item.id === id && item.role === 'admin');
      if (!user) return res.status(404).json({ success: false, message: 'Admin wilayah tidak ditemukan.' });
      Object.assign(user, { nama_lengkap: name, wilayah: region, nomor_telepon: phone || null, status });
      if (password) user.password = password;
      const { password: _password, ...safe } = user;
      return res.json({ success: true, data: safe });
    }
    const fields = [name, region, phone || null, status, id];
    await db.query("UPDATE users SET nama_lengkap=?,wilayah=?,nomor_telepon=?,status=? WHERE id=? AND role='admin'", fields);
    if (password) await db.query("UPDATE users SET password=? WHERE id=? AND role='admin'", [await bcrypt.hash(password, 12), id]);
    const [[user]] = await db.query("SELECT id,username,role,wilayah,nama_lengkap,nomor_telepon,status FROM users WHERE id=? AND role='admin'", [id]);
    if (!user) return res.status(404).json({ success: false, message: 'Admin wilayah tidak ditemukan.' });
    return res.json({ success: true, data: user });
  } catch (error) { return next(error); }
};

exports.activity = async (_req, res, next) => {
  try {
    if (isDemo()) return res.json({ success: true, data: demo.activity.slice(0, 500) });
    const [rows] = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};
